// PoC：评论内嵌工作项链接（从编辑器 DOM 原样复刻，含 linkdata）
import TapdSdk from '@opentapd/tapd-node-sdk';
import fs from 'node:fs';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;

// 编辑器 DOM 抓取的原生标记（link-card 展示层保留，确保渲染一致）
const anchor = fs.readFileSync('/tmp/link-anchor.html', 'utf8');
const r = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>内部链接验证（开放API复刻）：</p>${anchor}`, author: '徐昭',
});
console.log('评论 id:', r?.data?.Comment?.id, '| 存储长度:', r?.data?.Comment?.description?.length);
