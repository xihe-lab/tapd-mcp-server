// PoC：极简链接识别测试——纯文本 URL vs 朴素 <a>，看 TAPD 是否自动渲染为内部链接卡片
import TapdSdk from '@opentapd/tapd-node-sdk';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const URL_ = 'https://www.tapd.cn/tapd_fe/39814312/story/detail/1139814312001001533';

// 变体1：纯文本 URL（无任何标签）
const r1 = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>极简测试A-纯文本URL：</p><p>${URL_}</p>`, author: '徐昭',
});
console.log('A 纯文本URL → 评论', r1?.data?.Comment?.id);

// 变体2：朴素 <a href>（无 entity/tapd-id/linkdata）
const r2 = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>极简测试B-朴素锚点：</p><p><a href="${URL_}">zzz-delete-me-rc21-story-1788668959260</a></p>`, author: '徐昭',
});
console.log('B 朴素锚点 → 评论', r2?.data?.Comment?.id);
