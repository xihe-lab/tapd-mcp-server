// round-trip 契约测试：六类样本（@/附件/链接/图片/混合/纯文本）md→html→md 与原文等价（空白规约内）。
// 只覆盖纯函数语义层（本目录 fragment 函数），不经过工具/注册表转换主链路（接线归 Wave 2）。
import assert from 'node:assert/strict';
import { htmlToMdFragment, mdToHtmlFragment } from './index.js';

const WS = '39814312';

const AT = (name: string) =>
  `<b class="at-who" contenteditable="false" data-userid="${name}" data-type="user">@${name}</b>`;
const ANCHOR = (id: string, name: string, fileType: string) =>
  `<a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="${fileType}" ` +
  `data-name="${name}" target="_blank" rel="noopener" ` +
  `href="/${WS}/attachments/preview_attachments/${id}/story_description_attachment">${name}</a>`;

// 空白规约：允许转换层的空白差异（本层本不应产生，防御性归一）
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

interface Sample {
  name: string;
  md: string;
  html: string;
}

const SAMPLES: Sample[] = [
  {
    name: '样本1 @（中英文昵称、CJK 标点边界）',
    md: '请 @徐昭 今天内确认，备份联系 @bob_dev。',
    html: `请 ${AT('徐昭')} 今天内确认，备份联系 ${AT('bob_dev')}。`,
  },
  {
    name: '样本2 附件（pdf/text/other 映射）',
    md: `评审材料 [📎 接口设计.pdf](attach:${WS}/1139814312001000001)，日志 [📎 app.log](attach:${WS}/1139814312001000002)`,
    html: `评审材料 ${ANCHOR('1139814312001000001', '接口设计.pdf', 'pdf')}，日志 ${ANCHOR('1139814312001000002', 'app.log', 'other')}`,
  },
  {
    name: '样本3 链接（语义层零干预透传，基础转换器职责）',
    md: `需求详情见 [TAPD 1139814312001001548](https://www.tapd.cn/${WS}/prong/stories/view/1139814312001001548)`,
    html: `需求详情见 [TAPD 1139814312001001548](https://www.tapd.cn/${WS}/prong/stories/view/1139814312001001548)`,
  },
  {
    name: '样本4 图片（/tfl/ 远端路径，语义层零干预透传）',
    md: '效果图 ![登录页](/tfl/captures/2026/09/login.png)',
    html: '效果图 ![登录页](/tfl/captures/2026/09/login.png)',
  },
  {
    name: '样本5 混合（@ + @@转义 + 附件@名 + 图片 + 链接 + 粗体）',
    md: [
      '# rc.2 评审',
      '',
      '负责人 @徐昭，抄送 @@everyone（字面量）。',
      `材料 [📎 报表@v2.txt](attach:${WS}/1139814312001000003)，截图 ![首页](/tfl/a.png)。`,
      `线索 [需求](https://www.tapd.cn/${WS}/prong/stories/view/1139814312001001548) 与 **加粗**。`,
    ].join('\n'),
    html: [
      '# rc.2 评审',
      '',
      `负责人 ${AT('徐昭')}，抄送 @everyone（字面量）。`,
      `材料 ${ANCHOR('1139814312001000003', '报表@v2.txt', 'text')}，截图 ![首页](/tfl/a.png)。`,
      `线索 [需求](https://www.tapd.cn/${WS}/prong/stories/view/1139814312001001548) 与 **加粗**。`,
    ].join('\n'),
  },
  {
    name: '样本6 纯文本（邮箱/工单号/孤立 @ 不误伤，@@转义不触发 mention，FSD §8）',
    md: '版本 v1.2 已发布。联系邮箱 user@example.com；工单号 T-100@QA 由 support@test 处理；单独的 @ 保持原样，转义 @@support 也不触发 mention。',
    html: '版本 v1.2 已发布。联系邮箱 user@example.com；工单号 T-100@QA 由 support@test 处理；单独的 @ 保持原样，转义 @support 也不触发 mention。',
  },
];

const checks: [string, () => void][] = [
  ...SAMPLES.map((sample) => [
    `md→html: ${sample.name}`,
    () => {
      assert.equal(normalize(mdToHtmlFragment(sample.md)), normalize(sample.html));
    },
  ] as [string, () => void]),
  ...SAMPLES.map((sample) => [
    `html→md: ${sample.name}`,
    () => {
      assert.equal(normalize(htmlToMdFragment(sample.html)), normalize(sample.md));
    },
  ] as [string, () => void]),
  ...SAMPLES.map((sample) => [
    `round-trip: ${sample.name}`,
    () => {
      assert.equal(normalize(htmlToMdFragment(mdToHtmlFragment(sample.md))), normalize(sample.md));
      // 二次往返幂等（转换稳定点）
      const once = htmlToMdFragment(mdToHtmlFragment(sample.md));
      assert.equal(normalize(htmlToMdFragment(mdToHtmlFragment(once))), normalize(once));
    },
  ] as [string, () => void]),
  ['R7 回归: @昵称 产出 at-who 标记而非降级形态', () => {
    const html = mdToHtmlFragment('呼叫 @徐昭');
    assert.ok(html.includes('<b class="at-who" contenteditable="false" data-userid="徐昭" data-type="user">@徐昭</b>'));
    const md = htmlToMdFragment('<p><b class="at-who" contenteditable="false" data-userid="徐昭" data-type="user">@徐昭</b></p>');
    assert.equal(md, '<p>@徐昭</p>');
    assert.ok(!md.includes('**'));
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
