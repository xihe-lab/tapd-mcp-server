// PoC：附件锚点最小形态测试——裸 <a> vs 仅 data-is-tapd-attachment
import TapdSdk from '@opentapd/tapd-node-sdk';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const ATT_URL = `/${W}/attachments/preview_attachments/1139814312001000004/story_description_attachment`;

// 变体A：裸锚点（无任何 data 属性/类名）
const r1 = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>附件最小形态A-裸锚点：</p><a href="${ATT_URL}">comment-embed.txt</a>`, author: '徐昭',
});
console.log('A 裸锚点 → 评论', r1?.data?.Comment?.id);

// 变体B：仅 data-is-tapd-attachment（无类名无其余 data）
const r2 = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>附件最小形态B-仅标记：</p><a data-is-tapd-attachment="true" href="${ATT_URL}">comment-embed.txt</a>`, author: '徐昭',
});
console.log('B 仅标记 → 评论', r2?.data?.Comment?.id);
