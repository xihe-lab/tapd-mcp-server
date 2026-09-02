import assert from 'node:assert/strict';
import type { DerivedCommand } from '@xihe-lab/tapd-core';
import { format, unwrapEntity } from './formatter.js';
import { renderTable, strWidth } from './table.js';

const listCmd: DerivedCommand = {
  tool: 'tapd_get_stories',
  resource: 'story',
  action: 'list',
  write: false,
  hidden: false,
};

const detailCmd: DerivedCommand = {
  tool: 'tapd_get_story',
  resource: 'story',
  action: 'get',
  write: false,
  hidden: false,
};

const wrappedStories = [
  {
    Story: {
      id: '1135000000001',
      name: '登录页样式调整',
      priority_label: 'Medium',
      owner: 'zhangsan',
      status: 'inprogress',
      description: '调整登录页视觉细节',
    },
  },
  {
    Story: {
      id: '1135000000002',
      name: 'fix login redirect bug',
      priority_label: 'High',
      owner: 'lisi',
      status: 'closed',
      description: 'x',
    },
  },
];

const detail = { Story: { id: '1135000000001', name: '登录页样式调整', owner: 'zhangsan', tags: ['p0', 'web'] } };

const checks: [string, () => Promise<void> | void][] = [
  ['auto: 非 TTY 列表输出 json 且与 MCP content 同构（保留实体壳）', () => {
    const out = format({ ok: true, data: wrappedStories }, listCmd, { isTTY: false });
    assert.equal(out, JSON.stringify(wrappedStories, null, 2));
    assert.deepEqual(JSON.parse(out), wrappedStories);
  }],

  ['auto: 非 TTY 详情输出 json', () => {
    const out = format({ ok: true, data: detail }, detailCmd, { isTTY: false });
    assert.equal(out, JSON.stringify(detail, null, 2));
  }],

  ['auto: TTY 列表输出 table 且使用领域默认列', () => {
    const out = format({ ok: true, data: wrappedStories }, listCmd, { isTTY: true });
    const lines = out.split('\n');
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^id {2,}name {2,}priority_label {2,}owner {2,}status/);
    assert.ok(!out.includes('description'), '领域列之外的字段不出现');
    assert.ok(lines[1].startsWith('---'));
    assert.ok(out.includes('登录页样式调整'));
  }],

  ['auto: TTY 详情输出 text 逐行 key: value', () => {
    const out = format({ ok: true, data: detail }, detailCmd, { isTTY: true });
    assert.ok(out.includes('id: 1135000000001'));
    assert.ok(out.includes('name: 登录页样式调整'));
    assert.ok(out.includes('tags:\n  [\n    "p0",\n    "web"\n  ]'));
  }],

  ['auto: TTY + meta.outputFormat 覆盖列表默认 table', () => {
    const out = format({ ok: true, data: wrappedStories }, listCmd, {
      isTTY: true,
      meta: { resource: 'story', action: 'list', outputFormat: 'text' },
    });
    assert.ok(out.includes('id: 1135000000001'));
  }],

  ['auto: configuredFormat 优先级高于 meta.outputFormat', () => {
    const out = format({ ok: true, data: wrappedStories }, listCmd, {
      isTTY: true,
      configuredFormat: 'json',
      meta: { resource: 'story', action: 'list', outputFormat: 'text' },
    });
    assert.deepEqual(JSON.parse(out), wrappedStories);
  }],

  ['--output 显式三值全覆盖', () => {
    const asText = format({ ok: true, data: wrappedStories }, listCmd, { isTTY: false, output: 'text' });
    assert.ok(asText.includes('id: 1135000000001'));
    assert.equal(asText.split('\n\n').length, 2);
    const asTable = format({ ok: true, data: wrappedStories }, listCmd, { isTTY: false, output: 'table' });
    assert.ok(asTable.split('\n')[1].startsWith('---'));
    const asJson = format({ ok: true, data: wrappedStories }, listCmd, { isTTY: true, output: 'json' });
    assert.deepEqual(JSON.parse(asJson), wrappedStories);
  }],

  ['unwrapEntity: [{Story:{...}}] 剥壳、[{count:x}] 不剥、单对象壳同样剥', () => {
    const list = unwrapEntity(wrappedStories) as Record<string, unknown>[];
    assert.equal(list.length, 2);
    assert.deepEqual(Object.keys(list[0]).sort(), ['description', 'id', 'name', 'owner', 'priority_label', 'status']);
    const counted = unwrapEntity([{ count: '5' }]) as Record<string, unknown>[];
    assert.deepEqual(counted, [{ count: '5' }]);
    const single = unwrapEntity(detail) as Record<string, unknown>;
    assert.deepEqual(Object.keys(single), ['id', 'name', 'owner', 'tags']);
  }],

  ['领域列 fallback: story 五列；未知资源取全字段 key 前 6 列；meta.columns 优先', () => {
    const bugCmd: DerivedCommand = { ...listCmd, tool: 'tapd_get_bugs', resource: 'bug' };
    const bugTable = format({ ok: true, data: [{ Bug: { id: '1', title: 't', severity: '1', current_owner: 'a', status: 'new', extra: 'x' } }] }, bugCmd, { isTTY: true });
    assert.ok(bugTable.includes('current_owner'));
    const unknownCmd: DerivedCommand = { ...listCmd, resource: 'workspace' };
    const unknownTable = format(
      { ok: true, data: [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }] },
      unknownCmd,
      { isTTY: true },
    );
    const header = unknownTable.split('\n')[0];
    assert.ok(header.includes('f'));
    assert.ok(!header.includes(' g'), '仅前 6 列');
    const custom = format({ ok: true, data: wrappedStories }, listCmd, {
      isTTY: true,
      meta: { resource: 'story', action: 'list', columns: ['name', 'owner'] },
    });
    const customHeader = custom.split('\n')[0].trimEnd();
    assert.match(customHeader, /^name\s+owner$/);
  }],

  ['空结果三态: table/text 输出 (empty)，json 输出 []', () => {
    assert.equal(format({ ok: true, data: [] }, listCmd, { isTTY: true, output: 'table' }), '(empty)');
    assert.equal(format({ ok: true, data: [] }, listCmd, { isTTY: true, output: 'text' }), '(empty)');
    assert.equal(format({ ok: true, data: [] }, listCmd, { isTTY: true, output: 'json' }), '[]');
    assert.equal(format({ ok: true }, detailCmd, { isTTY: false, output: 'json' }), '[]');
    assert.equal(format({ ok: true }, detailCmd, { isTTY: true, output: 'text' }), '(empty)');
  }],

  ['CJK 对齐: 混排数据各行显示宽度一致，CJK 按 2 列计宽', () => {
    const out = format({ ok: true, data: wrappedStories }, listCmd, { isTTY: true });
    const widths = out.split('\n').map(line => strWidth(line));
    assert.equal(strWidth('登'), 2);
    assert.equal(strWidth('a'), 1);
    assert.ok(new Set(widths).size === 1, `所有行显示宽度一致，实际: ${widths.join(',')}`);
    assert.equal(widths[0], widths[widths.length - 1]);
  }],

  ['超长单元格截断加省略号，verbose 输出完整内容', () => {
    const longName = '这是一个非常非常非常非常非常非常非常非常长的需求标题用来验证截断逻辑';
    const data = [{ Story: { id: '1', name: longName, owner: 'a', status: 's' } }];
    const out = format({ ok: true, data }, listCmd, { isTTY: true });
    assert.ok(out.includes('…'), '默认 40 列宽内截断');
    const full = format({ ok: true, data }, listCmd, { isTTY: true, verbose: true });
    assert.ok(!full.includes('…'));
    assert.ok(full.includes(longName));
  }],

  ['renderTable 直调: CJK 列对齐快照', () => {
    const out = renderTable(
      [
        { id: '1', name: '需求A' },
        { id: '22', name: 'story-b' },
      ],
      ['id', 'name'],
    );
    const lines = out.split('\n');
    assert.deepEqual(
      lines.map(l => l),
      [
        'id  name   ',
        '--  -------',
        '1   需求A  ',
        '22  story-b',
      ],
      'CJK 名称按显示宽度 5 补齐，与 ascii 列对齐',
    );
  }],
];

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(error);
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
