// 绕过 MCP 富文本管道，直调 POST /comments 验证 at-who HTML 的存储保真度
import TapdSdk from '@opentapd/tapd-node-sdk';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const html = '<p><b class="at-who" contenteditable="false" data-userid="徐昭" data-type="user">@徐昭</b> 原始 API 直发 at-who HTML（PoC 样本2，可删除）</p>';
const r = await sdk.addComment({
  workspace_id: W,
  entry_type: 'stories',
  entry_id: '1139814312001001533',
  description: html,
  author: '徐昭',
});
console.log('addComment 响应:', JSON.stringify(r?.data ?? r, null, 1).slice(0, 600));
