// 用仓库里的真实截图重验可见性
import TapdSdk from '@opentapd/tapd-node-sdk';
import fs from 'node:fs';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const P = '/Users/xuzhao/workspace/xihe-lab/tapd-knowledge-base/tapd-requirement-screenshot.png';
const up = await sdk.uploadImage({ workspace_id: W, image: fs.createReadStream(P) });
console.log('uploadImage:', JSON.stringify(up?.data));
const r = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>可见图片验证（真实截图）：</p>${up?.data?.html_code}`, author: '徐昭',
});
console.log('评论 id:', r?.data?.Comment?.id);
