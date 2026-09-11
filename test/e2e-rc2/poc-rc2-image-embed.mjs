// PoC：评论内嵌图片（upload_image 的 /tfl/ 路径 → 评论 <img> → 网页渲染）
import TapdSdk from '@opentapd/tapd-node-sdk';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const STORY = '1139814312001001533';

// 1) 重新上传一张图（确保路径新鲜有效）
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-'));
const png = path.join(dir, 'poc.png');
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const up = await sdk.uploadImage({ workspace_id: W, image: fs.createReadStream(png) });
console.log('uploadImage:', JSON.stringify(up?.data));

// 2) 内嵌进评论（uploadImage 返回的 html_code 原样使用）
const r = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: STORY,
  description: `<p>内嵌图片验证（开放API复刻）：</p>${up?.data?.html_code}`, author: '徐昭',
});
console.log('评论:', JSON.stringify(r?.data?.Comment ?? r?.data).slice(0, 500));
