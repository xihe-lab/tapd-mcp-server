// mention 语义单测：生成/解析/扫描/边界误伤（FSD §8）/双向镜像。tsx 直跑，不进 package.json test 脚本（接线归集成者）。
import assert from 'node:assert/strict';
import {
  atWhoNodeToMd,
  escapeAtLiteralsForMd,
  findMentions,
  isAtWhoNode,
  isAtWhoTag,
  mentionHtmlToMd,
  mentionMdToHtml,
  renderMentionHtml,
} from './mention.js';

const AT_WHO_XUZHAO = '<b class="at-who" contenteditable="false" data-userid="徐昭" data-type="user">@徐昭</b>';

const checks: [string, () => void][] = [
  ['renderMentionHtml: 逐字段复刻 at-who 模板（e2e 金样）', () => {
    assert.equal(renderMentionHtml('徐昭'), AT_WHO_XUZHAO);
  }],

  ['renderMentionHtml: 昵称含 HTML 特殊字符分别转义 attr/文本位', () => {
    const html = renderMentionHtml('a"b<c>');
    assert.ok(html.includes('data-userid="a&quot;b&lt;c&gt;"'));
    assert.ok(html.endsWith('>@a"b&lt;c&gt;</b>'));
    assert.ok(html.startsWith('<b class="at-who" contenteditable="false" '));
  }],

  ['renderMentionHtml: 空昵称抛 TypeError', () => {
    assert.throws(() => renderMentionHtml(''), TypeError);
  }],

  ['findMentions: 基本命中与区间索引', () => {
    assert.deepEqual(findMentions('请 @徐昭 尽快确认'), [{ name: '徐昭', start: 2, end: 5 }]);
    assert.deepEqual(findMentions('no mention here'), []);
  }],

  ['findMentions: 右边界贪吃 + 多命中', () => {
    assert.deepEqual(findMentions('@bob_dev.'), [{ name: 'bob_dev', start: 0, end: 8 }]);
    assert.deepEqual(findMentions('@徐昭，你好'), [{ name: '徐昭', start: 0, end: 3 }]);
    assert.deepEqual(
      findMentions('找 @张三 和 @Alice_1 一起'),
      [
        { name: '张三', start: 2, end: 5 },
        { name: 'Alice_1', start: 8, end: 16 },
      ],
    );
  }],

  ['findMentions: FSD §8 误伤对策——邮箱/工单号/紧贴中文不命中', () => {
    assert.deepEqual(findMentions('联系 user@example.com 获取'), []);
    assert.deepEqual(findMentions('工单号 T-100@QA 由 support@test 处理'), []);
    assert.deepEqual(findMentions('联系@徐昭 谢谢'), []); // @ 前紧贴中文（保守侧不标记；R4 服务端仍识别）
    assert.deepEqual(findMentions('版本 v1.2@release'), []);
  }],

  ['findMentions: @@ 转义与孤立 @ 不命中', () => {
    assert.deepEqual(findMentions('@@徐昭'), []);
    assert.deepEqual(findMentions('行尾单独 @ 保持'), []);
    assert.deepEqual(findMentions('@'), []);
    assert.deepEqual(findMentions('@ 上路'), []);
  }],

  ['findMentions: 数字昵称与起始边界', () => {
    assert.deepEqual(findMentions('@123 上线'), [{ name: '123', start: 0, end: 4 }]);
    assert.deepEqual(findMentions('( @张三 )'), [{ name: '张三', start: 2, end: 5 }]);
  }],

  ['mentionMdToHtml: 昵称 → at-who，其余原样', () => {
    assert.equal(mentionMdToHtml('请 @徐昭 今天内确认'), `请 ${AT_WHO_XUZHAO} 今天内确认`);
  }],

  ['mentionMdToHtml: @@ → 字面 @ 不触发 mention；@@@ 组合行为', () => {
    assert.equal(mentionMdToHtml('@@徐昭'), '@徐昭');
    assert.equal(mentionMdToHtml('@@@徐昭'), `@${AT_WHO_XUZHAO}`);
    assert.equal(mentionMdToHtml('@@@@'), '@@');
  }],

  ['mentionMdToHtml: 疑似 html 标签区域 @ 语义跳过（透传）', () => {
    assert.equal(mentionMdToHtml('a <b>x@y</b> @徐昭'), `a <b>x@y</b> ${AT_WHO_XUZHAO}`);
  }],

  ['mentionHtmlToMd: at-who → @昵称，禁止降级 **粗体**（R7 回归）', () => {
    const md = mentionHtmlToMd(`<p>${AT_WHO_XUZHAO} 请查收</p>`);
    assert.equal(md, '<p>@徐昭 请查收</p>');
    assert.ok(!md.includes('**'));
  }],

  ['mentionHtmlToMd: 非 at-who 的 <b> 原样（不吞不转）', () => {
    assert.equal(mentionHtmlToMd('<b>user@x</b>'), '<b>user@x</b>');
  }],

  ['mentionHtmlToMd: 文本字面 @ 按 mention 规则保护为 @@；不命中者原样', () => {
    assert.equal(
      mentionHtmlToMd('<p>@x user@y.com @@z</p>'),
      '<p>@@x user@y.com @@@@z</p>',
    );
  }],

  ['escapeAtLiteralsForMd: 与 md 方向规则严格镜像', () => {
    assert.equal(escapeAtLiteralsForMd('@徐昭'), '@@徐昭');
    assert.equal(escapeAtLiteralsForMd('user@example.com'), 'user@example.com');
    assert.equal(escapeAtLiteralsForMd('@@'), '@@@@');
  }],

  ['isAtWhoTag / 节点辅助: class 识别与 data-userid 优先', () => {
    assert.equal(isAtWhoTag(AT_WHO_XUZHAO), true);
    assert.equal(isAtWhoTag('<b class="tapd-editor__bold">@徐昭</b>'), false);
    const node = {
      nodeName: 'B',
      getAttribute: (name: string) => (name === 'class' ? 'at-who' : name === 'data-userid' ? '徐昭' : null),
    };
    assert.equal(isAtWhoNode(node), true);
    assert.equal(atWhoNodeToMd(node), '@徐昭');
  }],

  ['节点辅助: data-userid 缺失回退文本', () => {
    const node = {
      nodeName: 'b',
      getAttribute: (name: string) => (name === 'class' ? 'at-who' : null),
      textContent: '@李四',
    };
    assert.equal(isAtWhoNode(node), true);
    assert.equal(atWhoNodeToMd(node), '@李四');
  }],

  ['mention 双向镜像: md→html→md 恒等（多边界样本）', () => {
    const samples = [
      '请 @徐昭 今天内确认，抄送 @bob_dev。',
      '@张三',
      'user@example.com 与 T-100@QA 与 @@李四 与 @',
      '（@王五）结束。',
    ];
    for (const md of samples) {
      assert.equal(mentionHtmlToMd(mentionMdToHtml(md)), md);
    }
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
