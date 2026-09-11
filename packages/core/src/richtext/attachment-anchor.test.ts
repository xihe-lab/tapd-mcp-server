// attachment-anchor 语义单测：fileTypeFor 映射 / md 扩展语法 / R6 五件套模板 / 解析容错 / 不认识锚点原样保留。
import assert from 'node:assert/strict';
import {
  ATTACH_SCHEME,
  DEFAULT_ATTACHMENT_SLUG,
  FILE_TYPE_BY_EXTENSION,
  attachmentAnchorHtml,
  attachmentAnchorMd,
  attachmentHtmlToMd,
  attachmentMdToHtml,
  fileTypeFor,
  findAttachmentAnchors,
  isAttachmentAnchorNode,
  attachmentAnchorNodeToMd,
  parseAttachmentAnchorHtml,
  parseAttachmentAnchorMd,
} from './attachment-anchor.js';

const WS = '39814312';
const ID = '1139814312001000001';

// 完整编辑器模板（含 inner spans / type / class，e2e 金样 poc-rc2-file-embed.mjs 同构）
const EDITOR_STYLE_ANCHOR =
  `<a data-is-tapd-attachment="true" contenteditable="false" target="_blank" rel="noopener" ` +
  `data-can-preview="true" data-file-type="text" type="text" data-name="comment-embed.txt" data-size="54" ` +
  `href="/${WS}/attachments/preview_attachments/1139814312001000004/story_description_attachment" ` +
  `class="tapd-editor__attachment-item"><span class="tapd-editor__attachment-item__left">` +
  `<span class="tapd-editor__attachment-item__text-wrapper">` +
  `<span class="tapd-editor__attachment-item__title">comment-embed.txt</span>` +
  `<span class="tapd-editor__attachment-item__size">0.00MB</span></span></span></a>`;

const checks: [string, () => void][] = [
  ['fileTypeFor: txt→text、png/jpg/jpeg→image、pdf→pdf、其他→other（大小写不敏感）', () => {
    assert.equal(fileTypeFor('说明.txt'), 'text');
    assert.equal(fileTypeFor('pic.PNG'), 'image');
    assert.equal(fileTypeFor('a.jpg'), 'image');
    assert.equal(fileTypeFor('a.jpeg'), 'image');
    assert.equal(fileTypeFor('doc.pdf'), 'pdf');
    assert.equal(fileTypeFor('app.log'), 'other');
    assert.equal(fileTypeFor('noext'), 'other');
    assert.equal(fileTypeFor('报表@v2.pdf'), 'pdf');
  }],

  ['FILE_TYPE_BY_EXTENSION: 映射表导出供 Wave 2 复用', () => {
    assert.equal(FILE_TYPE_BY_EXTENSION.txt, 'text');
    assert.equal(FILE_TYPE_BY_EXTENSION.png, 'image');
    assert.equal(FILE_TYPE_BY_EXTENSION.pdf, 'pdf');
    assert.equal(ATTACH_SCHEME, 'attach:');
    assert.equal(DEFAULT_ATTACHMENT_SLUG, 'story_description_attachment');
  }],

  ['attachmentAnchorMd: md 扩展语法生成', () => {
    assert.equal(attachmentAnchorMd({ workspaceId: WS, id: ID, name: '需求说明.txt' }),
      `[📎 需求说明.txt](attach:${WS}/${ID})`);
  }],

  ['attachmentAnchorMd: 文件名中 []\\ 转义可逆；非法 ws/id 抛错', () => {
    const md = attachmentAnchorMd({ workspaceId: WS, id: ID, name: 'a]b[ c\\d.txt' });
    assert.equal(md, `[📎 a\\]b\\[ c\\\\d.txt](attach:${WS}/${ID})`);
    const parsed = parseAttachmentAnchorMd(md);
    assert.equal(parsed?.name, 'a]b[ c\\d.txt');
    assert.throws(() => attachmentAnchorMd({ workspaceId: 'ws x', id: ID, name: 'f' }), TypeError);
    assert.throws(() => attachmentAnchorMd({ workspaceId: WS, id: '', name: 'f' }), TypeError);
  }],

  ['parseAttachmentAnchorMd: 非 attach: 链接与普通链接 → null', () => {
    assert.equal(parseAttachmentAnchorMd('[标题](https://www.tapd.cn/x)'), null);
    assert.equal(parseAttachmentAnchorMd('[📎 x](https://a/b)'), null);
    assert.equal(parseAttachmentAnchorMd('plain text'), null);
  }],

  ['parseAttachmentAnchorMd: 完整解析 ws/id/name', () => {
    const ref = parseAttachmentAnchorMd(`前缀 [📎 需求说明.txt](attach:${WS}/${ID}) 后缀`);
    assert.deepEqual(ref, { workspaceId: WS, id: ID, name: '需求说明.txt' });
  }],

  ['attachmentAnchorHtml: R6 定稿最小模板逐字段（含 size）', () => {
    assert.equal(
      attachmentAnchorHtml({ workspaceId: WS, id: ID, name: '接口设计.pdf', size: 2048 }),
      `<a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="pdf" ` +
      `data-name="接口设计.pdf" data-size="2048" target="_blank" rel="noopener" ` +
      `href="/${WS}/attachments/preview_attachments/${ID}/story_description_attachment">接口设计.pdf</a>`,
    );
  }],

  ['attachmentAnchorHtml: size 省略不输出 data-size；fileType 按扩展名默认映射；slug 可覆盖', () => {
    const html = attachmentAnchorHtml({ workspaceId: WS, id: ID, name: 'app.log' });
    assert.ok(html.includes('data-file-type="other"'));
    assert.ok(!html.includes('data-size'));
    assert.ok(html.includes(`href="/${WS}/attachments/preview_attachments/${ID}/story_description_attachment"`));
    const custom = attachmentAnchorHtml({ workspaceId: WS, id: ID, name: 'a.txt', fileType: 'text' }, { slug: 'bug_description_attachment' });
    assert.ok(custom.includes('/bug_description_attachment">'));
    assert.ok(custom.endsWith('>a.txt</a>'));
  }],

  ['attachmentAnchorHtml: 文件名 HTML 特殊字符转义', () => {
    const html = attachmentAnchorHtml({ workspaceId: WS, id: ID, name: 'a"b&c.txt' });
    assert.ok(html.includes('data-name="a&quot;b&amp;c.txt"'));
    assert.ok(html.endsWith('>a&quot;b&amp;c.txt</a>') === false);
    assert.ok(html.endsWith('>a"b&amp;c.txt</a>'));
  }],

  ['parseAttachmentAnchorHtml: 生成结果可逆解析', () => {
    const html = attachmentAnchorHtml({ workspaceId: WS, id: ID, name: '接口设计.pdf', size: 2048 });
    assert.deepEqual(parseAttachmentAnchorHtml(html), {
      workspaceId: WS, id: ID, name: '接口设计.pdf', size: 2048, fileType: 'pdf',
    });
  }],

  ['parseAttachmentAnchorHtml: 完整编辑器模板（inner spans/type/class）可识别', () => {
    assert.deepEqual(parseAttachmentAnchorHtml(EDITOR_STYLE_ANCHOR), {
      workspaceId: WS, id: '1139814312001000004', name: 'comment-embed.txt', size: 54, fileType: 'text',
    });
    assert.deepEqual(findAttachmentAnchors(`<p>前</p>${EDITOR_STYLE_ANCHOR}<p>后</p>`).length, 1);
  }],

  ['parseAttachmentAnchorHtml: 不认识的锚点 → null（裸 <a>/缺 data-name/缺 flag）', () => {
    assert.equal(parseAttachmentAnchorHtml(`<a href="/${WS}/attachments/preview_attachments/${ID}/story_description_attachment">x.txt</a>`), null);
    assert.equal(parseAttachmentAnchorHtml(`<a data-is-tapd-attachment="true" href="/${WS}/attachments/preview_attachments/${ID}/story_description_attachment">残缺</a>`), null);
    assert.equal(parseAttachmentAnchorHtml(`<a data-can-preview="true" data-name="x.txt" href="/${WS}/attachments/preview_attachments/${ID}/story_description_attachment">无flag</a>`), null);
    assert.equal(parseAttachmentAnchorHtml(`<a data-is-tapd-attachment="true" data-name="x.txt" href="https://elsewhere/x">外部链接</a>`), null);
  }],

  ['attachmentHtmlToMd: 锚点 → md 扩展语法；不认识锚点原样保留', () => {
    const md = attachmentHtmlToMd(`<p>材料</p>${EDITOR_STYLE_ANCHOR}`);
    assert.equal(md, `<p>材料</p>[📎 comment-embed.txt](attach:${WS}/1139814312001000004)`);
    const bare = `<a href="/${WS}/attachments/preview_attachments/${ID}/story_description_attachment">残缺</a>`;
    assert.equal(attachmentHtmlToMd(`<p>x</p>${bare}`), `<p>x</p>${bare}`);
    const plain = '<p>普通 <a href="https://e.com">链接</a></p>';
    assert.equal(attachmentHtmlToMd(plain), plain);
  }],

  ['attachmentMdToHtml: md → 锚点；非 attach 链接透传', () => {
    const html = attachmentMdToHtml(`见 [📎 需求说明.txt](attach:${WS}/${ID})`);
    assert.ok(html.startsWith('见 <a data-is-tapd-attachment="true"'));
    assert.ok(html.includes('data-name="需求说明.txt"'));
    assert.ok(html.endsWith(`>需求说明.txt</a>`));
    const link = '参考 [标题](https://e.com/a)';
    assert.equal(attachmentMdToHtml(link), link);
  }],

  ['attachmentMdToHtml: 多锚点与转义名可逆', () => {
    const md = `[📎 a.txt](attach:${WS}/1139814312001000002) 中间 [📎 b.pdf](attach:${WS}/${ID})`;
    const html = attachmentMdToHtml(md);
    assert.equal(findAttachmentAnchors(html).length, 2);
    assert.equal(attachmentHtmlToMd(html), md);
  }],

  ['节点辅助: isAttachmentAnchorNode / attachmentAnchorNodeToMd', () => {
    const node = {
      nodeName: 'A',
      getAttribute: (name: string) =>
        ({
          'data-is-tapd-attachment': 'true',
          'data-name': 'comment-embed.txt',
          'data-size': '54',
          'data-file-type': 'text',
          href: `/${WS}/attachments/preview_attachments/1139814312001000004/story_description_attachment`,
        })[name] ?? null,
    };
    assert.equal(isAttachmentAnchorNode(node), true);
    assert.equal(attachmentAnchorNodeToMd(node), `[📎 comment-embed.txt](attach:${WS}/1139814312001000004)`);
    const bare = { nodeName: 'A', getAttribute: () => null };
    assert.equal(isAttachmentAnchorNode(bare), false);
    assert.equal(attachmentAnchorNodeToMd(bare), null);
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
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
