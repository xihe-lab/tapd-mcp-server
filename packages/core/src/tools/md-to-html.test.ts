import assert from 'node:assert/strict';
import type { TapdClient } from '../tapd-client.js';
import { utilityTools } from './utility.js';
import { ToolRegistry } from '../registry/registry.js';

const mdToHtml = utilityTools.find(t => t.name === 'tapd_md_to_html')!;
const htmlToMd = utilityTools.find(t => t.name === 'tapd_html_to_md')!;

const fakeClient = {} as TapdClient;

async function mdRender(content: string): Promise<string> {
  const result = await mdToHtml.handler(fakeClient, { content }) as { html: string };
  return result.html;
}

async function mdFromHtml(html: string): Promise<string> {
  const result = await htmlToMd.handler(fakeClient, { html }) as { markdown: string };
  return result.markdown;
}

const checks: [string, () => Promise<void> | void][] = [
  ['md->html: headings h1-h4', async () => {
    const html = await mdRender('# t1\n\n## t2\n\n### t3\n\n#### t4');
    assert.ok(html.includes('<h1>t1</h1>'));
    assert.ok(html.includes('<h2>t2</h2>'));
    assert.ok(html.includes('<h3>t3</h3>'));
    assert.ok(html.includes('<h4>t4</h4>'));
  }],

  ['md->html: paragraph, bold, italic, inline code', async () => {
    const html = await mdRender('a **b** *c* `d`');
    assert.ok(html.includes('<p>a <strong>b</strong> <em>c</em> <code>d</code></p>'));
  }],

  ['md->html: fenced code block', async () => {
    const html = await mdRender('```js\nconst x = 1;\n```');
    assert.match(html, /<pre><code class="language-js">const x = 1;\n<\/code><\/pre>/);
  }],

  ['md->html: ul, ol, blockquote', async () => {
    const html = await mdRender('- a\n- b\n\n1. x\n2. y\n\n> q');
    assert.match(html, /<ul>\n<li>a<\/li>\n<li>b<\/li>\n<\/ul>/);
    assert.match(html, /<ol>\n<li>x<\/li>\n<li>y<\/li>\n<\/ol>/);
    assert.match(html, /<blockquote>\n<p>q<\/p>\n<\/blockquote>/);
  }],

  ['md->html: gfm table', async () => {
    const html = await mdRender('| a | b |\n|---|---|\n| 1 | 2 |');
    assert.match(html, /<th>a<\/th>/);
    assert.match(html, /<td>1<\/td>/);
    assert.match(html, /<td>2<\/td>/);
  }],

  ['md->html: link and hr', async () => {
    const html = await mdRender('[t](https://e.com)\n\n---');
    assert.ok(html.includes('<a href="https://e.com">t</a>'));
    assert.ok(html.includes('<hr>'));
  }],

  ['md->html: raw html escaped (html:false)', async () => {
    const html = await mdRender('<script>x</script>');
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
  }],

  ['md->html: breaks single newline becomes <br>', async () => {
    const html = await mdRender('l1\nl2');
    assert.match(html, /<p>l1<br>\nl2<\/p>/);
  }],

  ['html->md: TAPD description structure', async () => {
    const md = await mdFromHtml([
      '<p><strong>背景</strong></p>',
      '<p>订单同步<em>偶发</em>失败，需排查 <code>order_id</code>。</p>',
      '<h3>方案</h3>',
      '<ul><li>接入回调</li><li>重试 <strong>3</strong> 次</li></ul>',
      '<table><thead><tr><th>字段</th><th>说明</th></tr></thead><tbody><tr><td>order_id</td><td>单号</td></tr></tbody></table>',
      '<blockquote><p>注意：先灰度</p></blockquote>',
      '<pre><code>curl /api/v1/orders</code></pre>',
    ].join(''));
    assert.ok(md.includes('**背景**'));
    assert.ok(md.includes('_偶发_'));
    assert.ok(md.includes('`order_id`'));
    assert.ok(md.includes('### 方案'));
    assert.match(md, /\*\s+接入回调/);
    assert.ok(md.includes('**3** 次'));
    assert.match(md, /\|\s*字段\s*\|\s*说明\s*\|/);
    assert.match(md, /\|\s*order\\_id\s*\|\s*单号\s*\|/);
    assert.ok(md.includes('> 注意：先灰度'));
    assert.ok(md.includes('```\ncurl /api/v1/orders\n```'));
  }],

  ['html->md: br, hr, link, ordered list', async () => {
    const md = await mdFromHtml('<p>line1<br>line2</p><hr><p><a href="https://e.com">t</a></p><ol><li>o1</li><li>o2</li></ol>');
    assert.match(md, /line1 {2}\nline2/);
    assert.ok(md.includes('* * *'));
    assert.ok(md.includes('[t](https://e.com)'));
    assert.match(md, /1\.\s+o1/);
    assert.match(md, /2\.\s+o2/);
  }],

  ['roundtrip: md -> html -> md -> html stays equivalent', async () => {
    const markdown = '# 标题\n\n段落 **加粗** 和 `code`。\n\n- a\n- b\n\n| x | y |\n|--|--|\n| 1 | 2 |\n\n> 引用';
    const html1 = await mdRender(markdown);
    const md2 = await mdFromHtml(html1);
    const html2 = await mdRender(md2);
    assert.equal(html2, html1);
  }],

  ['registry: both tools are read-only pure compute, exec without credentials', async () => {
    const registry = new ToolRegistry();
    registry.register(utilityTools);
    const result = await registry.exec('tapd_md_to_html', { content: '# hi' }, { entry: 'cli', readOnly: true }, () => ({}) as TapdClient);
    assert.equal(result.ok, true);
    assert.equal((result.data as { html: string }).html, '<h1>hi</h1>\n');

    const back = await registry.exec('tapd_html_to_md', { html: '<h1>hi</h1>' }, { entry: 'cli', readOnly: true }, () => ({}) as TapdClient);
    assert.equal(back.ok, true);
    assert.ok((back.data as { markdown: string }).markdown.includes('# hi'));

    const missing = await registry.exec('tapd_md_to_html', {}, { entry: 'cli' }, () => ({}) as TapdClient);
    assert.equal(missing.error?.code, 'INVALID_ARGS');
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
