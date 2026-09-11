// rc.2 PoC 最终版（2026-09-11 真机验证通过）：附件上传（含实体绑定）+ 富文本图片上传
// 运行：cd packages/core && TAPD_ACCESS_TOKEN=... node poc-rc2-upload.mjs
// 结论见 ../../tapd-knowledge-base/rc2-painpoints-research.md（同机兄弟仓库）
import TapdSdk from '@opentapd/tapd-node-sdk';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';

const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID || '39814312';
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tp-')), 'demo.txt');
fs.writeFileSync(f, 'demo content');

// 附件上传 + 实体绑定（一次调用）。
// 关键：file 必须是 fs.createReadStream 或 FILE 实例（SDK multipart 只认这两种，见 node-sdk/src/sdk.js:159）；
// type 枚举实测 'task'/'bug' 可用（'task' 对 story 实体同样生效），'story'/'stories' 服务端报错。
const r = await sdk.uploadAttachment({
  workspace_id: W,
  filename: 'demo.txt',
  type: 'task',                       // story 实体也用 'task'（实测绑定正确）
  entry_id: '1139814312001000048',    // 目标实体长 ID（字符串）
  file: fs.createReadStream(f),
});
console.log('uploadAttachment:', JSON.stringify(r?.data ?? r, null, 1));

// 富文本图片上传：返回 image_src(/tfl/pictures/...) + html_code，直接嵌入 description/comment
const r2 = await sdk.uploadImage({ workspace_id: W, image: fs.createReadStream(f) });
console.log('uploadImage:', JSON.stringify(r2?.data ?? r2, null, 1));
