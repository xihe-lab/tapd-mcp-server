/**
 * rc.2 attachment / media tool tests (FSD §3.1-3.4, requirements
 * 1139814312001001546 + 1139814312001001547 upload part).
 *
 * Run directly: npx tsx src/tools/attachment.test.ts (from packages/core)
 * Mock client pattern follows md-to-html.test.ts — no real credentials.
 */
import assert from 'node:assert/strict';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdtemp, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { TapdClient, FileUploadParam } from '../tapd-client.js';
import { ToolRegistry } from '../registry/registry.js';
import { resolveWrite } from '../registry/write-policy.js';
import {
  MAX_UPLOAD_BYTES,
  attachmentTools,
  buildAttachmentAnchor,
  buildAttachmentMarkdown,
  resolveLocalFile,
  sanitizeFilename,
} from './attachment.js';
import { mediaTools } from './media.js';

// ---------------------------------------------------------------------------
// Recording mock client (never hits the network for TAPD API calls)
// ---------------------------------------------------------------------------

class RecordingClient {
  readonly postFileCalls: { path: string; params: Record<string, FileUploadParam> }[] = [];
  readonly getCalls: { path: string; params?: Record<string, unknown> }[] = [];
  readonly postCalls: { path: string; params?: Record<string, unknown> }[] = [];
  postFileResponse: unknown = {
    Attachment: { id: '1139814312001009001', filename: 'demo.txt', size: 11, content_type: 'text/plain' },
  };
  getResponse: unknown = {
    Attachment: {
      download_url: 'https://file.tapd.cn/signed/demo',
      filename: 'demo.txt',
      content_type: 'text/plain',
    },
  };
  postResponse: unknown = {
    OpenAppObjAttachment: { id: '9001', title: 'ext-file', source_url: 'https://third.example/f.png' },
  };

  postFile<T>(p: string, params: Record<string, FileUploadParam>): Promise<T> {
    this.postFileCalls.push({ path: p, params });
    return Promise.resolve(this.postFileResponse as T);
  }

  get<T>(p: string, params?: Record<string, unknown>): Promise<T> {
    this.getCalls.push({ path: p, params });
    return Promise.resolve(this.getResponse as T);
  }

  post<T>(p: string, params?: Record<string, unknown>): Promise<T> {
    this.postCalls.push({ path: p, params });
    return Promise.resolve(this.postResponse as T);
  }
}

const recShared = new RecordingClient();
const mockClient = recShared as unknown as TapdClient;

const WS = 39814312;
const uploadTool = attachmentTools.find(t => t.name === 'tapd_upload_attachment')!;
const downloadTool = attachmentTools.find(t => t.name === 'tapd_download_attachment')!;
const externalTool = attachmentTools.find(t => t.name === 'tapd_attach_external_file')!;
const imageTool = mediaTools.find(t => t.name === 'tapd_upload_image')!;

interface UploadResult {
  id: string;
  embed_html: string;
  embed_md: string;
  [key: string]: unknown;
}

interface DownloadResult {
  id: string;
  filename: string;
  content_type?: string;
  download_url: string;
  saved_to?: string;
  bytes?: number;
  sha1?: string;
}

const tmpRoot = await mkdtemp(path.join(tmpdir(), 'tapd-rc2-att-test-'));

async function tempFile(name: string, content: string | Buffer): Promise<string> {
  const p = path.join(tmpRoot, name);
  await writeFile(p, content);
  return p;
}

/** Sparse file (no real 300MB write) for the oversize branch. */
async function sparseFile(name: string, sizeBytes: number): Promise<string> {
  const p = path.join(tmpRoot, name);
  const handle = await open(p, 'w');
  try {
    await handle.truncate(sizeBytes);
  } finally {
    await handle.close();
  }
  return p;
}

/** Local HTTP server helper for postFile channel + download byte-stream tests. */
async function withServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body: Buffer) => void
): Promise<{
  port: number;
  requests: { headers: http.IncomingHttpHeaders; url?: string; body: Buffer }[];
  close: () => Promise<void>;
}> {
  const requests: { headers: http.IncomingHttpHeaders; url?: string; body: Buffer }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      requests.push({ headers: req.headers, url: req.url, body });
      handler(req, res, body);
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close(() => resolve()).on('error', reject)),
  };
}

const checks: [string, () => Promise<void> | void][] = [
  // ---------------------------------------------------------------- anchor
  ['anchor: R6 data五件套 + target/rel + href + 锚点文本 齐全', () => {
    const html = buildAttachmentAnchor({ workspace_id: WS, id: '1139814312001009001', filename: 'demo.txt', size: 54 });
    assert.ok(html.startsWith('<a ') && html.endsWith('</a>'));
    assert.ok(html.includes('data-is-tapd-attachment="true"'));
    assert.ok(html.includes('data-can-preview="true"'));
    assert.ok(html.includes('data-file-type="text"')); // .txt → 实证 'text'
    assert.ok(html.includes('data-name="demo.txt"'));
    assert.ok(html.includes('data-size="54"'));
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes('rel="noopener"'));
    assert.ok(html.includes(`href="/${WS}/attachments/preview_attachments/1139814312001009001/story_description_attachment"`));
    assert.ok(html.includes('>demo.txt</a>')); // 锚点文本 = 文件名
  }],

  ['anchor: 转义与 file_type 兜底', () => {
    const quoted = buildAttachmentAnchor({ workspace_id: String(WS), id: 1, filename: 'a"b&<c>.xyz', size: 3 });
    assert.ok(!quoted.includes('a"b&<c>'));
    assert.ok(quoted.includes('data-name="a&quot;b&amp;&lt;c&gt;.xyz"'));
    assert.ok(quoted.includes('data-file-type="xyz"')); // 未知扩展名 → 扩展名直通
    const noExt = buildAttachmentAnchor({ workspace_id: 1, id: 2, filename: 'noext', size: 1 });
    assert.ok(noExt.includes('data-file-type="other"'));
    const override = buildAttachmentAnchor({ workspace_id: 1, id: 2, filename: 'a.png', size: 1, file_type: 'psd' });
    assert.ok(override.includes('data-file-type="psd"'));
  }],

  ['anchor/md helpers: markdown 引用模板', () => {
    assert.equal(buildAttachmentMarkdown(WS, '9001', '设计稿.png'), `[📎 设计稿.png](attach:${WS}/9001)`);
  }],

  ['sanitize: 文件名去路径分隔符', () => {
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeFilename('a\\b\\c.png'), 'c.png');
    assert.equal(sanitizeFilename('  name with space.txt '), 'name with space.txt');
    assert.equal(sanitizeFilename(''), 'attachment');
  }],

  // ------------------------------------------------------- upload attachment
  ['upload: type=entity_type 直通 + ReadStream + basename 缺省 + embed 字段', async () => {
    const file = await tempFile('demo.txt', 'demo content');
    const rec = new RecordingClient();
    const result = await uploadTool.handler(rec as unknown as TapdClient, {
      workspace_id: WS,
      file_path: file,
      entity_type: 'story' as const,
      entity_id: '1139814312001001533',
    }) as UploadResult;

    assert.equal(rec.postFileCalls.length, 1);
    const call = rec.postFileCalls[0];
    assert.equal(call.path, '/files/upload_attachment');
    assert.equal(call.params.type, 'story'); // entity_type 直通为 API type
    assert.equal(call.params.entry_id, '1139814312001001533');
    assert.equal(call.params.filename, 'demo.txt'); // 缺省取 basename
    assert.equal(call.params.workspace_id, WS);
    assert.ok(call.params.file instanceof ReadStream);
    assert.ok(String(call.params.file.path).endsWith('demo.txt'));

    assert.equal(result.id, '1139814312001009001');
    assert.ok(result.embed_html.includes('data-is-tapd-attachment="true"'));
    assert.ok(result.embed_html.includes('data-name="demo.txt"'));
    assert.ok(result.embed_html.includes(`href="/${WS}/attachments/preview_attachments/1139814312001009001/`));
    assert.equal(result.embed_md, `[📎 demo.txt](attach:${WS}/1139814312001009001)`);
  }],

  ['upload: entity_type 白名单拒绝（story/bug/task 之外 → INVALID_ARGS）', async () => {
    const registry = new ToolRegistry();
    registry.register(attachmentTools);
    const file = await tempFile('w.txt', 'x');
    const bad = await registry.exec(
      'tapd_upload_attachment',
      { workspace_id: WS, file_path: file, entity_type: 'wiki', entity_id: '1139814312001001533' },
      { entry: 'cli' },
      () => mockClient
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.error?.code, 'INVALID_ARGS');
    assert.ok(bad.error?.message.includes('entity_type'));
    assert.equal(recShared.postFileCalls.length, 0); // 未触达通道
  }],

  ['upload: 文件不存在 → INVALID_ARGS（FSD §3.1 ENOENT→参数错误）', async () => {
    const registry = new ToolRegistry();
    registry.register(attachmentTools);
    const res = await registry.exec(
      'tapd_upload_attachment',
      { workspace_id: WS, file_path: '/nonexistent/definitely-missing.bin', entity_type: 'story', entity_id: '1139814312001001533' },
      { entry: 'cli' },
      () => mockClient
    );
    assert.equal(res.ok, false);
    assert.equal(res.error?.code, 'INVALID_ARGS');
  }],

  ['upload: filename 参数做路径穿越清洗', async () => {
    const file = await tempFile('san.txt', 'x');
    const rec = new RecordingClient();
    await uploadTool.handler(rec as unknown as TapdClient, {
      workspace_id: WS,
      file_path: file,
      entity_type: 'bug' as const,
      entity_id: '1139814312001001546',
      filename: '../../../evil/name.txt',
    });
    assert.equal(rec.postFileCalls[0].params.filename, 'name.txt');
  }],

  ['upload: 超 300MB 明确报错（稀疏文件实测）', async () => {
    assert.equal(MAX_UPLOAD_BYTES, 300 * 1024 * 1024);
    const big = await sparseFile('big.bin', MAX_UPLOAD_BYTES + 1024);
    assert.throws(() => resolveLocalFile(big), /file too large.*300MB/s);
    assert.throws(() => resolveLocalFile('/nonexistent/big.bin'), /file not found/);
  }],

  ['upload: write 语义 + readOnly 门禁', async () => {
    assert.equal(resolveWrite(uploadTool), true); // upload_ 命中 WRITE_VERBS
    assert.equal(resolveWrite(downloadTool), false); // download 保持 L0
    assert.equal(resolveWrite(externalTool), true); // 显式 write: true（attach 不在动词表）
    assert.equal(resolveWrite(imageTool), true);

    const registry = new ToolRegistry();
    registry.register([...attachmentTools, ...mediaTools]);
    const file = await tempFile('ro.txt', 'x');
    const blocked = await registry.exec(
      'tapd_upload_attachment',
      { workspace_id: WS, file_path: file, entity_type: 'story', entity_id: '1139814312001001533' },
      { entry: 'cli', readOnly: true },
      () => mockClient
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error?.code, 'READ_ONLY_BLOCKED');
  }],

  // ----------------------------------------------------- download attachment
  ['download: 无 out_path 仅返回元数据', async () => {
    const rec = new RecordingClient();
    const result = await downloadTool.handler(rec as unknown as TapdClient, {
      workspace_id: WS,
      id: '1139814312001009001',
    }) as DownloadResult;
    assert.equal(rec.getCalls[0].path, '/attachments/down');
    assert.equal(result.download_url, 'https://file.tapd.cn/signed/demo');
    assert.equal(result.filename, 'demo.txt');
    assert.equal(result.content_type, 'text/plain');
    assert.equal(result.saved_to, undefined);
  }],

  ['download: out_path 路径穿越拒绝', async () => {
    const rec = new RecordingClient();
    await assert.rejects(
      downloadTool.handler(rec as unknown as TapdClient, { workspace_id: WS, id: '1', out_path: '../escape.bin' }),
      /out_path must stay within the working directory/
    );
    await assert.rejects(
      downloadTool.handler(rec as unknown as TapdClient, { workspace_id: WS, id: '1', out_path: path.join(tmpdir(), 'absolute-escape.bin') }),
      /out_path must stay within the working directory/
    );
  }],

  ['download: 落盘返回 bytes + sha1（已知向量）', async () => {
    const payload = Buffer.from('hello-rc2-download-bytes', 'utf8');
    const server = await withServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(payload);
    });
    try {
      const rec = new RecordingClient();
      rec.getResponse = { Attachment: { download_url: `http://127.0.0.1:${server.port}/bytes`, filename: 'vec.bin' } };
      const outDir = path.join(process.cwd(), '.tmp-rc2-att-dl-test');
      await mkdir(outDir, { recursive: true });
      try {
        const result = await downloadTool.handler(rec as unknown as TapdClient, {
          workspace_id: WS,
          id: '1139814312001009001',
          out_path: outDir, // 已存在目录 → 取附件名落盘
        }) as DownloadResult;
        assert.equal(result.sha1, '3ebbc308cf9df7d3ccceb5b956c676db6e688d40');
        assert.equal(result.bytes, payload.length);
        const savedTo = result.saved_to;
        assert.ok(savedTo);
        assert.ok(savedTo.startsWith(outDir + path.sep));
        assert.equal(path.basename(savedTo), 'vec.bin');
        assert.equal((await readFile(savedTo)).toString(), payload.toString());
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    } finally {
      await server.close();
    }
  }],

  // ---------------------------------------------- external file attachment
  ['attach-external: entity_type→entry_type 映射 + creator 可选', async () => {
    const rec = new RecordingClient();
    await externalTool.handler(rec as unknown as TapdClient, {
      workspace_id: WS,
      title: 'ext-file',
      source_url: 'https://third.example/f.png',
      entity_type: 'task' as const,
      entity_id: '1139814312001000048',
    });
    const call = rec.postCalls[0];
    assert.equal(call.path, '/open_app_obj_attachment');
    assert.equal(call.params?.type, 'png'); // default
    assert.equal(call.params?.entry_type, 'task');
    assert.equal(call.params?.entry_id, '1139814312001000048');
    assert.equal(call.params?.source_url, 'https://third.example/f.png');
    assert.equal(call.params?.creator, undefined);

    const rec2 = new RecordingClient();
    await externalTool.handler(rec2 as unknown as TapdClient, {
      workspace_id: WS,
      title: 't',
      source_url: 'https://x/y.psd',
      entity_type: 'story' as const,
      entity_id: '1',
      type: 'psd' as const,
      creator: '徐昭',
    });
    assert.equal(rec2.postCalls[0].params?.type, 'psd');
    assert.equal(rec2.postCalls[0].params?.creator, '徐昭');
  }],

  ['attach-external: type 枚举仅 png/psd', async () => {
    const registry = new ToolRegistry();
    registry.register(attachmentTools);
    const bad = await registry.exec(
      'tapd_attach_external_file',
      { workspace_id: WS, title: 't', source_url: 'https://x/y', entity_type: 'story', entity_id: '1', type: 'doc' },
      { entry: 'cli' },
      () => mockClient
    );
    assert.equal(bad.error?.code, 'INVALID_ARGS');
  }],

  // ------------------------------------------------------------ upload image
  ['upload_image: 路由 /files/upload_image + 返回 image_src/html_code/markdown', async () => {
    const png = await tempFile('poc.png', Buffer.from('89504e47', 'hex'));
    const rec = new RecordingClient();
    rec.postFileResponse = {
      image_src: '/tfl/pictures/202509/poc.png',
      html_code: '<img src="/tfl/pictures/202509/poc.png" />',
    };
    const result = await imageTool.handler(rec as unknown as TapdClient, {
      workspace_id: WS,
      image_path: png,
    }) as Record<string, string>;
    assert.equal(rec.postFileCalls[0].path, '/files/upload_image');
    assert.ok(rec.postFileCalls[0].params.image instanceof ReadStream);
    assert.equal(result.image_src, '/tfl/pictures/202509/poc.png');
    assert.ok(result.html_code.includes('<img'));
    assert.equal(result.markdown, '![image](/tfl/pictures/202509/poc.png)');
  }],

  ['upload_image: 图片缺失 → INVALID_ARGS', async () => {
    const registry = new ToolRegistry();
    registry.register(mediaTools);
    const res = await registry.exec(
      'tapd_upload_image',
      { workspace_id: WS, image_path: '/nonexistent/img.png' },
      { entry: 'cli' },
      () => mockClient
    );
    assert.equal(res.ok, false);
    assert.equal(res.error?.code, 'INVALID_ARGS');
  }],

  // ------------------------------------- postFile channel (SDK + fetch path)
  ['postFile: SDK multipart 通道（鉴权头/字段/multipart content-type）', async () => {
    const file = await tempFile('chan.txt', 'channel-bytes');
    const server = await withServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 1, data: { Attachment: { id: '1', filename: 'chan.txt' } }, info: 'success' }));
    });
    const { TapdClient } = await import('../tapd-client.js');
    try {
      const client = TapdClient.fromAccessToken('tok-abc', `http://127.0.0.1:${server.port}`);
      const data = await client.postFile<{ Attachment: { id: string } }>('/files/upload_attachment', {
        workspace_id: WS,
        filename: 'chan.txt',
        type: 'story',
        entry_id: '1139814312001001533',
        file: createReadStream(file),
      });
      assert.equal(data.Attachment.id, '1');
      assert.equal(server.requests.length, 1);
      const req = server.requests[0];
      assert.equal(req.url, '/files/upload_attachment');
      assert.equal(req.headers.authorization, 'Bearer tok-abc');
      assert.ok(String(req.headers['content-type']).startsWith('multipart/form-data; boundary='));
      const bodyText = req.body.toString('latin1');
      assert.ok(bodyText.includes('name="workspace_id"'));
      assert.ok(bodyText.includes(String(WS)));
      assert.ok(bodyText.includes('name="type"'));
      assert.ok(bodyText.includes('story'));
      assert.ok(bodyText.includes('name="entry_id"'));
      assert.ok(bodyText.includes('1139814312001001533'));
      assert.ok(bodyText.includes('filename="chan.txt"'));
      assert.ok(bodyText.includes('channel-bytes')); // 文件字节真的进了 multipart body
    } finally {
      await server.close();
    }
  }],

  ['postFile: 无 SDK 路由时 fetch multipart 兜底（TAPD_SDK_DISABLED=1 回滚开关）', async () => {
    const prev = process.env.TAPD_SDK_DISABLED;
    process.env.TAPD_SDK_DISABLED = '1';
    const { TapdClient } = await import('../tapd-client.js');
    const server = await withServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 1, data: { image_src: '/tfl/x.png', html_code: '<img/>' }, info: 'success' }));
    });
    try {
      const file = await tempFile('fallback.png', Buffer.from('pngbytes'));
      const client = TapdClient.fromAccessToken('tok-xyz', `http://127.0.0.1:${server.port}`);
      const data = await client.postFile<{ image_src: string }>('/files/upload_image', {
        workspace_id: WS,
        image: createReadStream(file),
      });
      assert.equal(data.image_src, '/tfl/x.png');
      const req = server.requests[0];
      assert.equal(req.headers.authorization, 'Bearer tok-xyz');
      assert.ok(String(req.headers['content-type']).startsWith('multipart/form-data; boundary='));
      const bodyText = req.body.toString('latin1');
      assert.ok(bodyText.includes('name="workspace_id"'));
      assert.ok(bodyText.includes('filename="fallback.png"'));
      assert.ok(bodyText.includes('pngbytes'));
    } finally {
      if (prev === undefined) delete process.env.TAPD_SDK_DISABLED;
      else process.env.TAPD_SDK_DISABLED = prev;
      await server.close();
    }
  }],

  ['postFile: POST 失败不回退不重试（防重复上传）', async () => {
    const { TapdClient } = await import('../tapd-client.js');
    const server = await withServer((_req, res) => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('boom');
    });
    try {
      const file = await tempFile('fail.txt', 'x');
      const client = TapdClient.fromAccessToken('tok', `http://127.0.0.1:${server.port}`);
      await assert.rejects(
        client.postFile('/files/upload_attachment', {
          workspace_id: 1,
          filename: 'fail.txt',
          type: 'story',
          entry_id: '2',
          file: createReadStream(file),
        }),
        /500/
      );
      assert.equal(server.requests.length, 1); // 只打了一次
    } finally {
      await server.close();
    }
  }],

  // ---------------------------------------------------------------- CLI meta
  ['cli meta: positional/资源动作派生元数据齐全', () => {
    assert.deepEqual(
      { resource: uploadTool.cli?.resource, action: uploadTool.cli?.action, positional: uploadTool.cli?.positional },
      { resource: 'attachment', action: 'upload', positional: 'file_path' }
    );
    assert.deepEqual(
      { resource: downloadTool.cli?.resource, action: downloadTool.cli?.action, positional: downloadTool.cli?.positional },
      { resource: 'attachment', action: 'download', positional: 'id' }
    );
    assert.deepEqual(
      { resource: externalTool.cli?.resource, action: externalTool.cli?.action, positional: externalTool.cli?.positional },
      { resource: 'attachment', action: 'attach-external', positional: undefined }
    );
    assert.deepEqual(
      { resource: imageTool.cli?.resource, action: imageTool.cli?.action, positional: imageTool.cli?.positional },
      { resource: 'image', action: 'upload', positional: 'image_path' }
    );
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(`  ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
}

await rm(tmpRoot, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length}/${checks.length} passed`);
}
