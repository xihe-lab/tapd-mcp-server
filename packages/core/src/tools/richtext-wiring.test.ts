/**
 * rc.2 P3 接线测试（需求 1139814312001001548 P3 + 1139814312001001547 P2 md 闭环）。
 *
 * 覆盖（FSD §3.4-3.6 / §3.7 / §8）：
 *   1. tapd_md_to_html upload_images：本地图上传替换（mock 上传）、失败清单、远端路径不动、去重单次上传
 *   2. tapd_md_to_html workspace_id：@昵称成员校验 warnings + /users 不可用降级跳过
 *   3. @ 语义 token 级转换：code_span / 链接 URL / 裸 URL / 邮箱 / 工单号内 @ 不误伤
 *   4. raw_html 透传对比：写工具 md 管道 vs raw_html 直发（registry 实链路 + D8 双写不破坏）
 *   5. turndown 规则顺序：保真规则（at-who/附件锚点）先于 GFM/内建规则匹配
 *
 * Run directly: npx tsx src/tools/richtext-wiring.test.ts (from packages/core)
 * Mock client pattern follows attachment.test.ts — no real credentials.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ReadStream } from 'node:fs';
import type { TapdClient, FileUploadParam } from '../tapd-client.js';
import { ToolRegistry } from '../registry/registry.js';
import { transformWriteArgs } from '../registry/richtext.js';
import { utilityTools } from './utility.js';
import { allTools } from './index.js';

// ---------------------------------------------------------------------------
// Recording mock client
// ---------------------------------------------------------------------------

class RecordingClient {
  readonly postFileCalls: { path: string; params: Record<string, FileUploadParam> }[] = [];
  readonly getCalls: { path: string; params?: Record<string, unknown> }[] = [];
  readonly postCalls: { path: string; params?: Record<string, unknown> }[] = [];
  postFileResponse: unknown = { image_src: '/tfl/pictures/202609/uploaded.png' };
  getResponse: unknown = [];
  postResponse: unknown = { Comment: { id: '9001' } };

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

const WS = 39814312;
const registry = new ToolRegistry();
registry.register(allTools);
const mdToHtmlTool = utilityTools.find(t => t.name === 'tapd_md_to_html')!;
const htmlToMdTool = utilityTools.find(t => t.name === 'tapd_html_to_md')!;
const createCommentTool = registry.get('tapd_create_comment')!;

async function mdRender(params: Record<string, unknown>, client: TapdClient = new RecordingClient() as unknown as TapdClient) {
  return mdToHtmlTool.handler(client, params) as Promise<Record<string, unknown>>;
}

async function mdFromHtml(html: string): Promise<string> {
  const result = await htmlToMdTool.handler({} as TapdClient, { html }) as { markdown: string };
  return result.markdown;
}

const AT = (name: string) =>
  `<b class="at-who" contenteditable="false" data-userid="${name}" data-type="user">@${name}</b>`;

const tmpRoot = await mkdtemp(path.join(tmpdir(), 'tapd-rc2-wiring-'));
async function tempFile(name: string, content: string | Buffer): Promise<string> {
  const p = path.join(tmpRoot, name);
  await writeFile(p, content);
  return p;
}

const checks: [string, () => Promise<void> | void][] = [
  // -------------------------------------------------- 1. upload_images (P2 闭环)
  ['upload_images: 本地图上传并替换为 /tfl/（返回 uploaded_images 清单 + ReadStream 进 multipart）', async () => {
    const img = await tempFile('shot.png', Buffer.from('89504e47', 'hex'));
    const dotted = `${tmpRoot}/./shot.png`; // 同一文件的另一种写法（resolve 后同路径）
    const rec = new RecordingClient();
    const result = await mdRender({ content: `看截图 ![首页](${dotted}) 与 ![首页](${img})`, upload_images: true, workspace_id: WS }, rec as unknown as TapdClient);
    // 同一文件去重：单次上传（绝对路径归一）
    assert.equal(rec.postFileCalls.length, 1);
    assert.equal(rec.postFileCalls[0].path, '/files/upload_image');
    assert.ok(rec.postFileCalls[0].params.image instanceof ReadStream);
    const html = result.html as string;
    assert.ok(html.includes('<img src="/tfl/pictures/202609/uploaded.png" alt="首页">'), html);
    assert.ok(!html.includes('shot.png'));
    // 两种写法都替换为同一 /tfl/ 路径；上传清单只记真实发生的 1 次上传
    assert.equal((html.match(/\/tfl\/pictures\/202609\/uploaded\.png/g) ?? []).length, 2);
    assert.deepEqual(result.uploaded_images, [
      { local_path: dotted, image_src: '/tfl/pictures/202609/uploaded.png' },
    ]);
    assert.equal(result.failed_images, undefined);
  }],

  ['upload_images: 缺失文件列入 failed_images 不中断；远端 /tfl/ 与 http(s) 路径原样保留', async () => {
    const rec = new RecordingClient();
    const result = await mdRender({
      content: '![远端](/tfl/a.png) ![网站](https://cdn.example/x.png) ![丢失](./nope-missing.png)',
      upload_images: true,
      workspace_id: WS,
    }, rec as unknown as TapdClient);
    assert.equal(rec.postFileCalls.length, 0, '远端路径绝不触发上传');
    const html = result.html as string;
    assert.ok(html.includes('src="/tfl/a.png"'));
    assert.ok(html.includes('src="https://cdn.example/x.png"'));
    assert.ok(html.includes('src="./nope-missing.png"'));
    assert.deepEqual(result.failed_images, [{ local_path: './nope-missing.png', reason: 'file not found: ./nope-missing.png (resolved: ' + path.resolve('./nope-missing.png') + ')' }]);
  }],

  ['upload_images: 无 workspace 且无默认配置 → 明确报错；默认 false 零副作用', async () => {
    const rec = new RecordingClient();
    await assert.rejects(
      mdToHtmlTool.handler(rec as unknown as TapdClient, { content: '![a](./x.png)', upload_images: true }),
      /workspace_id is required/
    );
    const result = await mdRender({ content: '![a](./x.png)' }, rec as unknown as TapdClient);
    assert.equal(rec.postFileCalls.length, 0, '默认关闭时不触达上传通道');
    assert.ok((result.html as string).includes('src="./x.png"'));
  }],

  ['upload_images 语义：md_to_html 保持读闸门外（write=false），side_effect=upload 供审计（FSD §3.4）', () => {
    const def = registry.get('tapd_md_to_html')!;
    assert.equal(def.write ?? false, false, '不计入实体写闸门');
    assert.equal(def.side_effect, 'upload');
  }],

  // -------------------------------------------------- 2. @昵称成员校验 (§3.6)
  ['workspace_id 提供时：未命中昵称进 warnings，命中不提示', async () => {
    const rec = new RecordingClient();
    rec.getResponse = [{ User: { user: '徐昭' } }, { User: { user: 'bob' } }];
    const result = await mdRender({ content: '请 @徐昭 与 @ghost 与 @bob 处理', workspace_id: WS }, rec as unknown as TapdClient);
    assert.equal(rec.getCalls[0].path, '/users');
    assert.equal((rec.getCalls[0].params!).workspace_id, WS);
    assert.ok((result.html as string).includes(AT('徐昭')));
    assert.deepEqual(result.warnings, ['@ghost 未命中项目成员昵称（请核对昵称拼写；关键通知场景建议同时填 cc）']);
  }],

  ['workspace_id 校验降级：/users 403/失败 → 跳过校验并提示，转换不受影响', async () => {
    const rec = new RecordingClient();
    rec.get = () => Promise.reject(new Error('403 Forbidden: users::_get required'));
    const result = await mdRender({ content: '请 @徐昭 处理', workspace_id: WS }, rec as unknown as TapdClient);
    assert.ok((result.html as string).includes(AT('徐昭')));
    const warnings = result.warnings as string[];
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /成员校验已跳过.*403/);
    assert.match(warnings[0], /服务端智能识别/);
  }],

  ['未提供 workspace_id：零额外请求（校验不触发），纯转换', async () => {
    const rec = new RecordingClient();
    const result = await mdRender({ content: '请 @徐昭 处理' }, rec as unknown as TapdClient);
    assert.equal(rec.getCalls.length, 0);
    assert.equal(result.warnings, undefined);
    assert.ok((result.html as string).includes(AT('徐昭')));
  }],

  // -------------------------------------------------- 3. @ token 级不误伤 (§8)
  ['@ token 级：code_span / 链接 URL / 裸 URL / 邮箱 / 工单号 内 @ 不误伤', async () => {
    const result = await mdRender({ content: '联系 user@example.com；工单 T-100@QA；代码 `@code_x`；链接 [标题](https://e.com/@li)；裸地址 https://e.com/@wang；真提及 @徐昭' });
    const html = result.html as string;
    assert.ok(html.includes('user@example.com'));
    assert.ok(html.includes('T-100@QA'));
    assert.ok(html.includes('<code>@code_x</code>'));
    assert.ok(html.includes('href="https://e.com/@li"'));
    assert.ok(html.includes('https://e.com/@wang'));
    assert.equal(html.match(/at-who/g)?.length, 1, '仅真提及生成一个 at-who');
    assert.ok(html.includes(AT('徐昭')));
  }],

  ['@ 转义 @@ 与列表/引用上下文：@@ → 字面 @，块内提及照常', async () => {
    const result = await mdRender({ content: '- 字面 @@support\n> 引用里 @李四' });
    const html = result.html as string;
    assert.ok(html.includes('字面 @support'));
    assert.ok(!html.includes('@@'));
    assert.ok(html.includes(AT('李四')));
  }],

  ['attach: 链接 token 级转换：→ R6 五件套锚点；链接文本/URL 内 @ 不二次处理', async () => {
    const result = await mdRender({ content: `材料 [📎 报表@v2.txt](attach:${WS}/1139814312001000001)，普通 [链接](https://e.com)。` });
    const html = result.html as string;
    assert.ok(html.includes('data-is-tapd-attachment="true"'));
    assert.ok(html.includes('data-file-type="text"'));
    assert.ok(html.includes('data-name="报表@v2.txt"'));
    assert.ok(html.includes(`href="/${WS}/attachments/preview_attachments/1139814312001000001/story_description_attachment"`));
    assert.ok(html.includes('href="https://e.com"'));
    assert.ok(!html.includes('attach:'), 'attach: scheme 已被锚点替换');
  }],

  // -------------------------------------------------- 4. raw_html 透传对比 (§3.5)
  ['raw_html=false（默认）：写管道 md→html + @/附件语义自动转换', async () => {
    const rec = new RecordingClient();
    await registry.exec(
      'tapd_create_comment',
      { workspace_id: WS, entry_type: 'stories', entry_id: '1139814312001001533', description: '变更通知：@徐昭 请确认，材料 [📎 说明.txt](attach:39814312/1)' },
      { entry: 'cli' },
      () => rec as unknown as TapdClient
    );
    const params = rec.postCalls[0].params!;
    assert.equal(params.description, `<p>变更通知：${AT('徐昭')} 请确认，材料 <a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="text" data-name="说明.txt" target="_blank" rel="noopener" href="/39814312/attachments/preview_attachments/1/story_description_attachment">说明.txt</a></p>\n`);
    assert.equal(params.raw_html, undefined, 'raw_html 参数消费后不透传 TAPD API');
  }],

  ['raw_html=true：description 原样透传（绕过 md→html），参数摘除', async () => {
    const rec = new RecordingClient();
    const raw = '<p>原文 <b>HTML</b>：@徐昭 不转换、[📎 a.txt](attach:1/2) 不转换</p>';
    await registry.exec(
      'tapd_create_comment',
      { workspace_id: WS, entry_type: 'stories', entry_id: '1139814312001001533', description: raw, raw_html: true },
      { entry: 'cli' },
      () => rec as unknown as TapdClient
    );
    const params = rec.postCalls[0].params!;
    assert.equal(params.description, raw, '一字不改直发（R7 服务端保真）');
    assert.equal(params.raw_html, undefined);
  }],

  ['raw_html 对比 registry.exec：md 管道 vs raw_html 同文异果', async () => {
    const mdPath = await registry.exec(
      'tapd_create_comment',
      { workspace_id: WS, entry_type: 'stories', entry_id: '1', description: 'hello @徐昭 **加粗**' },
      { entry: 'cli' },
      () => ({ post: () => Promise.resolve({}) }) as unknown as TapdClient
    );
    assert.equal(mdPath.ok, true);
    const rawRec = new RecordingClient();
    await registry.exec(
      'tapd_create_comment',
      { workspace_id: WS, entry_type: 'stories', entry_id: '1', description: 'hello @徐昭 **加粗**', raw_html: true },
      { entry: 'cli' },
      () => rawRec as unknown as TapdClient
    );
    assert.equal((rawRec.postCalls[0].params!).description, 'hello @徐昭 **加粗**');
  }],

  ['raw_html=true：D8 双写不破坏（wiki markdown_description 维持既有策略——永不自动改写、无 md 源时不回填）', () => {
    const raw = '<p>HTML 正文 @徐昭</p>';
    // wiki：raw_html 时 description 透传，markdown_description 不被自动回填为 HTML
    const wikiRaw = transformWriteArgs('tapd_create_wiki', { description: raw, raw_html: true });
    assert.equal(wikiRaw.description, raw);
    assert.equal(wikiRaw.markdown_description, undefined);
    assert.equal(wikiRaw.raw_html, undefined);

    // 对照组（raw_html=false）：双写生效——description 渲染、markdown_description 保留 md 源
    const wikiMd = transformWriteArgs('tapd_create_wiki', { description: '# 标题 @徐昭' });
    assert.ok((wikiMd.description as string).includes('<h1>标题 '));
    assert.ok((wikiMd.description as string).includes(AT('徐昭')));
    assert.equal(wikiMd.markdown_description, '# 标题 @徐昭');

    // 用户显式提供的 markdown_description 始终原样（raw_html 与否一致）
    const wikiExplicit = transformWriteArgs('tapd_create_wiki', { description: raw, markdown_description: '自有 md', raw_html: true });
    assert.equal(wikiExplicit.markdown_description, '自有 md');

    // story（非双写）：raw_html 透传；对照走管道
    const storyRaw = transformWriteArgs('tapd_create_story', { description: raw, raw_html: true });
    assert.equal(storyRaw.description, raw);
    const storyMd = transformWriteArgs('tapd_create_story', { description: '正文 @徐昭' });
    assert.ok((storyMd.description as string).includes(AT('徐昭')));

    // raw_html 仅是语义开关：TAPD_RICHTEXT_AUTO=0 时同样摘除、全原样
    const prev = process.env.TAPD_RICHTEXT_AUTO;
    process.env.TAPD_RICHTEXT_AUTO = '0';
    try {
      const off = transformWriteArgs('tapd_create_comment', { description: '正文 @徐昭', raw_html: true });
      assert.equal(off.description, '正文 @徐昭');
      assert.equal(off.raw_html, undefined);
    } finally {
      if (prev === undefined) delete process.env.TAPD_RICHTEXT_AUTO;
      else process.env.TAPD_RICHTEXT_AUTO = prev;
    }
  }],

  // -------------------------------------------------- 5. turndown 规则顺序 (§8)
  ['turndown 保真规则先于 GFM/内建规则：at-who 不降级 **粗体**，附件锚点不被当普通链接', async () => {
    const md = await mdFromHtml(
      `<p>负责人 ${AT('徐昭')}，材料 <a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="pdf" data-name="设计.pdf" data-size="9" target="_blank" rel="noopener" href="/39814312/attachments/preview_attachments/2/story_description_attachment">设计.pdf</a></p>`
    );
    assert.ok(md.includes('@徐昭'));
    assert.ok(!md.includes('**'), `at-who 禁止降级为粗体: ${md}`);
    assert.ok(md.includes('[📎 设计.pdf](attach:39814312/2)'));
    assert.ok(!md.includes('href='), '附件锚点不得残留为普通链接');
  }],

  ['turndown 规则优先级：保真规则 unshift 后先于 GFM 表格/删除线与内建 strong/inlineLink 匹配', async () => {
    // 表格单元格 + 删除线 + 粗体 + 链接混排：保真语义优先，GFM 其余能力不受影响
    const html = '<table><thead><tr><th>负责人</th><th>材料</th></tr></thead><tbody><tr><td>' + AT('徐昭') + '</td><td>' +
      '<a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="other" data-name="a.bin" href="/39814312/attachments/preview_attachments/3/story_description_attachment">a.bin</a>' +
      '</td></tr></tbody></table><p><b>普通粗体</b> <a href="https://e.com">普通链接</a></p>';
    const md = await mdFromHtml(html);
    assert.ok(md.includes('@徐昭'));
    assert.ok(md.includes('[📎 a.bin](attach:39814312/3)'));
    assert.ok(md.includes('**普通粗体**'));
    assert.ok(md.includes('[普通链接](https://e.com)'));
    assert.match(md, /\|\s*负责人\s*\|\s*材料\s*\|/);
  }],

  ['html→md：字面 @ 加倍保 round-trip，CODE 内 @ 不加倍', async () => {
    const md = await mdFromHtml('<p>找 @徐昭 或字面 @support，代码 <code>@code_x</code></p>');
    assert.ok(md.includes('@@徐昭'), 'html→md 方向 mention 加倍为 @@（round-trip 稳定）');
    assert.ok(md.includes('@@support'));
    assert.ok(md.includes('`@code_x`'), 'code_span 内 @ 原样');
    // round-trip 稳定
    const once = await mdRender({ content: md });
    const again = await mdFromHtml(once.html as string);
    assert.equal(again, md);
  }],

  ['registry 全量注册：10 个富文本写工具均带 raw_html 通道（comment/story/task/bug/wiki create+update）', () => {
    const expected = [
      'tapd_create_comment', 'tapd_update_comment',
      'tapd_create_story', 'tapd_update_story',
      'tapd_create_task', 'tapd_update_task',
      'tapd_create_bug', 'tapd_update_bug',
      'tapd_create_wiki', 'tapd_update_wiki',
    ];
    for (const name of expected) {
      const tool = registry.get(name)!;
      // 从 zod schema shape 中确认 raw_html 字段存在且默认 false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shape = (tool.inputSchema as any).shape as Record<string, { isOptional?: () => boolean }>;
      assert.ok(shape.raw_html, `${name} 缺 raw_html 参数`);
    }
    // 基线不回归：工具总数保持 216 + tapd_md_to_html/html_to_md 增参不新增工具
    assert.equal(registry.list().length, 216);
  }],

  ['cli meta：md-to-html 增参不影响派生命令；tapd_html_to_md 纯读不受写闸门影响', async () => {
    assert.equal(createCommentTool.name, 'tapd_create_comment');
    const back = await registry.exec(
      'tapd_html_to_md',
      { html: `<p>${AT('徐昭')}</p>` },
      { entry: 'cli', readOnly: true },
      () => ({}) as TapdClient
    );
    assert.equal(back.ok, true);
    assert.equal((back.data as { markdown: string }).markdown, '@徐昭');
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
