import assert from 'node:assert/strict';
import type { TapdClient } from '../tapd-client.js';
import { allTools } from '../tools/index.js';
import { resolveWrite } from './write-policy.js';
import { ToolRegistry } from './registry.js';
import {
  DUAL_WRITE_TOOLS,
  WRITE_RICHTEXT_FIELDS_BY_TOOL,
} from './richtext-manifests.generated.js';
import {
  isRichtextAutoEnabled,
  looksLikeHtml,
  transformWriteArgs,
  transformReadData,
  READ_RICHTEXT_FIELDS,
} from './richtext.js';

const RICHTEXT_PARAM_FIELDS = ['description', 'markdown_description'];

function withAutoOff<T>(fn: () => T): T {
  process.env.TAPD_RICHTEXT_AUTO = '0';
  try {
    return fn();
  } finally {
    delete process.env.TAPD_RICHTEXT_AUTO;
  }
}

const checks: [string, () => Promise<void> | void][] = [
  ['switch: enabled by default, env TAPD_RICHTEXT_AUTO=0 disables', () => {
    delete process.env.TAPD_RICHTEXT_AUTO;
    assert.equal(isRichtextAutoEnabled(), true);
    assert.equal(withAutoOff(() => isRichtextAutoEnabled()), false);
  }],

  ['looksLikeHtml: block tags detected, plain markdown not', () => {
    assert.equal(looksLikeHtml('<p>hi</p>'), true);
    assert.equal(looksLikeHtml('标题<br>正文'), true);
    assert.equal(looksLikeHtml('# 标题\n\n- 列表'), false);
    assert.equal(looksLikeHtml('1 < 2 且 a>b'), false);
  }],

  ['write: markdown converted to html for client-side tools', () => {
    const args = transformWriteArgs('tapd_create_story', {
      name: 't',
      description: '# 标题\n\n- a\n- b',
    });
    assert.equal(args.name, 't');
    assert.match(args.description as string, /<h1>标题<\/h1>/);
    assert.match(args.description as string, /<li>a<\/li>/);
  }],

  ['write: html passthrough unchanged (存量 HTML 零破坏)', () => {
    const html = '<p>存量 <strong>HTML</strong></p>';
    const args = transformWriteArgs('tapd_create_story', { description: html });
    assert.equal(args.description, html);
  }],

  ['write: wiki dual-write renders html description and keeps md original', () => {
    const md = '# wiki md\n\n- a\n- b';
    const args = transformWriteArgs('tapd_create_wiki', {
      name: 'w',
      description: md,
    });
    assert.match(args.description as string, /<h1>wiki md<\/h1>/);
    assert.match(args.description as string, /<li>a<\/li>/);
    assert.equal(args.markdown_description, md);
  }],

  ['write: wiki html passthrough keeps description', () => {
    const html = '<p>wiki html</p>';
    const args = transformWriteArgs('tapd_update_wiki', { id: '1', description: html });
    assert.equal(args.description, html);
    assert.equal(args.markdown_description, undefined);
  }],

  ['write: explicit markdown_description wins over converted description', () => {
    const args = transformWriteArgs('tapd_create_wiki', {
      name: 'w',
      description: '# md from description',
      markdown_description: '# explicit md',
    });
    assert.equal(args.markdown_description, '# explicit md');
    assert.match(args.description as string, /<h1>md from description<\/h1>/);
  }],

  ['write: switch off leaves args untouched', () => {
    const md = '# 原样';
    const out = withAutoOff(() => transformWriteArgs('tapd_create_story', { description: md }));
    assert.equal(out.description, md);
    const wiki = withAutoOff(() => transformWriteArgs('tapd_create_wiki', { description: md }));
    assert.equal(wiki.description, md);
    assert.equal(wiki.markdown_description, undefined);
  }],

  ['write: tools without richtext fields untouched', () => {
    const args = transformWriteArgs('tapd_get_stories', { description: '# not a write tool' });
    assert.equal(args.description, '# not a write tool');
  }],

  ['read: nested and array richtext fields converted to markdown', () => {
    const data = {
      data: {
        Story: { id: '1', description: '<h1>标题</h1><p><strong>加粗</strong></p>' },
        list: [{ id: '2', description: '<ul><li>项</li></ul>' }],
        info: { Comments: [{ id: '3', description: '<p>评论 <code>代码</code></p>' }] },
      },
    };
    const result = transformReadData(data) as typeof data;
    assert.equal(result.data.Story.id, '1');
    assert.match(result.data.Story.description, /# 标题/);
    assert.match(result.data.Story.description, /\*\*加粗\*\*/);
    assert.match((result.data.list[0].description), /\*\s+项/);
    assert.match((result.data.info.Comments[0].description), /评论 `代码`/);
  }],

  ['read: plain-text and non-richtext fields untouched', () => {
    const data = {
      description: '纯文本没有标签',
      name: 'a<b 的名字',
      note: '<p>note 不在富文本清单</p>',
      nested: { description: '' },
    };
    const result = transformReadData(data) as typeof data;
    assert.equal(result.description, '纯文本没有标签');
    assert.equal(result.name, 'a<b 的名字');
    assert.equal(result.note, '<p>note 不在富文本清单</p>');
    assert.equal(result.nested.description, '');
  }],

  ['read: legacy wiki falls back to markdown_description when description empty', () => {
    const data = {
      id: '1',
      title: 'legacy',
      description: '',
      markdown_description: '# 存量 md\n\n**加粗**',
    };
    const result = transformReadData(data) as typeof data;
    assert.equal(result.description, '# 存量 md\n\n**加粗**');
    assert.equal(result.markdown_description, '# 存量 md\n\n**加粗**');
  }],

  ['read: fallback skips when description already has content', () => {
    const html = '<p>已有正文</p>';
    const data = {
      description: html,
      markdown_description: '**存量 md**',
    };
    const result = transformReadData(data) as { description: string; markdown_description: string };
    assert.match(result.description, /已有正文/);
  }],

  ['read: switch off returns raw html', () => {
    const data = { description: '<p>raw</p>' };
    const result = withAutoOff(() => transformReadData(data));
    assert.equal(result, data);
  }],

  ['read: gfm tables and fenced code survive', () => {
    const html = '<table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table><pre><code>echo hi</code></pre>';
    const md = transformReadData({ description: html }) as { description: string };
    assert.match(md.description, /\|\s*列\s*\|/);
    assert.match(md.description, /```\necho hi\n```/);
  }],

  ['exec: write tool receives converted html at client', async () => {
    delete process.env.TAPD_RICHTEXT_AUTO;
    let captured: Record<string, unknown> | undefined;
    const registry = new ToolRegistry();
    registry.register([allTools.find(t => t.name === 'tapd_create_story')!]);
    const result = await registry.exec(
      'tapd_create_story',
      { name: 'zzz-delete-me', description: '# hi', workspace_id: 39814312, owner: 'x', workitem_type_id: '1139814312001000001' },
      { entry: 'mcp' },
      () => ({
        post: (_path: string, body: Record<string, unknown>) => {
          captured = body;
          return Promise.resolve({ status: 1, data: {} });
        },
      }) as unknown as TapdClient,
    );
    assert.equal(result.ok, true);
    assert.match(captured?.description as string, /<h1>hi<\/h1>/);
  }],

  ['exec: wiki create two-phase writes html then md original', async () => {
    delete process.env.TAPD_RICHTEXT_AUTO;
    const posts: Record<string, unknown>[] = [];
    const registry = new ToolRegistry();
    registry.register([allTools.find(t => t.name === 'tapd_create_wiki')!]);
    const result = await registry.exec(
      'tapd_create_wiki',
      { name: 'zzz-delete-me-d8fix', workspace_id: 39814312, creator: 'x', description: '# 标题\n\n**加粗** 文本\n\n- 项' },
      { entry: 'mcp' },
      () => ({
        post: (_path: string, body: Record<string, unknown>) => {
          posts.push(body);
          return Promise.resolve({ Wiki: { id: '123' } });
        },
      }) as unknown as TapdClient,
    );
    assert.equal(result.ok, true);
    assert.equal(posts.length, 2);
    assert.match(posts[0].description as string, /<h1>标题<\/h1>/);
    assert.match(posts[0].description as string, /<strong>加粗<\/strong>/);
    assert.equal(posts[0].markdown_description, undefined);
    assert.equal(posts[1].id, '123');
    assert.match(posts[1].description as string, /<h1>标题<\/h1>/);
    assert.match(posts[1].markdown_description as string, /\*\*加粗\*\*/);
  }],

  ['exec: wiki create auto-off sends single raw request', async () => {
    process.env.TAPD_RICHTEXT_AUTO = '0';
    try {
      const posts: Record<string, unknown>[] = [];
      const registry = new ToolRegistry();
      registry.register([allTools.find(t => t.name === 'tapd_create_wiki')!]);
      const result = await registry.exec(
        'tapd_create_wiki',
        { name: 'zzz-delete-me-d8fix', workspace_id: 39814312, creator: 'x', description: '# 原样' },
        { entry: 'cli' },
        () => ({
          post: (_path: string, body: Record<string, unknown>) => {
            posts.push(body);
            return Promise.resolve({ Wiki: { id: '123' } });
          },
        }) as unknown as TapdClient,
      );
      assert.equal(result.ok, true);
      assert.equal(posts.length, 1);
      assert.equal(posts[0].description, '# 原样');
      assert.equal(posts[0].markdown_description, undefined);
    } finally {
      delete process.env.TAPD_RICHTEXT_AUTO;
    }
  }],

  ['exec: read tool returns markdown description', async () => {
    delete process.env.TAPD_RICHTEXT_AUTO;
    const registry = new ToolRegistry();
    registry.register([allTools.find(t => t.name === 'tapd_get_stories')!]);
    const result = await registry.exec(
      'tapd_get_stories',
      { workspace_id: 39814312 },
      { entry: 'mcp' },
      () => ({
        get: () => Promise.resolve({ status: 1, data: [{ id: '1', description: '<p>富文本 <strong>加粗</strong></p>' }] }),
      }) as unknown as TapdClient,
    );
    assert.equal(result.ok, true);
    const data = result.data as { data: { description: string }[] };
    assert.match(data.data[0].description, /富文本 \*\*加粗\*\*/);
  }],

  ['exec: switch off keeps raw html on both sides', async () => {
    process.env.TAPD_RICHTEXT_AUTO = '0';
    try {
      const registry = new ToolRegistry();
      registry.register([allTools.find(t => t.name === 'tapd_create_story')!]);
      let captured: Record<string, unknown> | undefined;
      const result = await registry.exec(
        'tapd_create_story',
        { name: 'zzz-delete-me', description: '# 原样', workspace_id: 39814312, owner: 'x', workitem_type_id: '1139814312001000001' },
        { entry: 'cli' },
        () => ({
          post: (_path: string, body: Record<string, unknown>) => {
            captured = body;
            return Promise.resolve({ status: 1, data: {} });
          },
        }) as unknown as TapdClient,
      );
      assert.equal(result.ok, true);
      assert.equal(captured?.description, '# 原样');
    } finally {
      delete process.env.TAPD_RICHTEXT_AUTO;
    }
  }],

  ['roundtrip: md -> html(write) -> md(read) -> html stays stable', () => {
    delete process.env.TAPD_RICHTEXT_AUTO;
    const markdown = '# 标题\n\n段落 **加粗** `code`。\n\n- a\n- b\n\n| x | y |\n|--|--|\n| 1 | 2 |';
    const written = transformWriteArgs('tapd_create_story', { description: markdown });
    const html1 = written.description as string;
    const readBack = transformReadData({ description: html1 }) as { description: string };
    const written2 = transformWriteArgs('tapd_create_story', { description: readBack.description });
    assert.equal(written2.description, html1);
  }],

  ['manifests: generated write-field list matches live schema scan', () => {
    const scanned: Record<string, string[]> = {};
    for (const tool of allTools) {
      if (!resolveWrite(tool)) continue;
      const shape = (tool.inputSchema as { shape?: Record<string, unknown> }).shape ?? {};
      const fields = RICHTEXT_PARAM_FIELDS.filter(f => f in shape);
      if (fields.length > 0) scanned[tool.name] = fields;
    }
    assert.deepEqual(WRITE_RICHTEXT_FIELDS_BY_TOOL, scanned);
    assert.equal(Object.keys(scanned).length >= 25, true);
    for (const name of DUAL_WRITE_TOOLS) {
      assert.ok(scanned[name]?.includes('description'), name);
      assert.ok(scanned[name]?.includes('markdown_description'), name);
    }
  }],

  ['manifests: read fields cover TAPD richtext naming convention', () => {
    assert.deepEqual([...READ_RICHTEXT_FIELDS].sort(), ['description']);
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
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length}/${checks.length} passed`);
}
