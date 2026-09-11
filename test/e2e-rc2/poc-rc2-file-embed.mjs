// PoC：评论内嵌文件（开放 API 复刻）——修正 type='story' + 真实需求 entry_id
import TapdSdk from '@opentapd/tapd-node-sdk';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const STORY = '1139814312001001533';

const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tp-')), 'comment-embed.txt');
fs.writeFileSync(f, 'rc.2 PoC：评论内嵌文件（开放API复刻，可删除）');

const up = await sdk.uploadAttachment({
  workspace_id: W, filename: 'comment-embed.txt', type: 'story',
  entry_id: STORY, file: fs.createReadStream(f),
});
const att = up?.data?.Attachment;
console.log('上传:', JSON.stringify(att));

const anchor = `<a data-is-tapd-attachment="true" contenteditable="false" target="_blank" rel="noopener" data-can-preview="true" data-file-type="text" type="text" data-name="${att.filename}" data-size="54" href="/${W}/attachments/preview_attachments/${att.id}/story_description_attachment" class="tapd-editor__attachment-item"><span class="tapd-editor__attachment-item__left"><span class="tapd-editor__attachment-item__text-wrapper"><span class="tapd-editor__attachment-item__title">${att.filename}</span><span class="tapd-editor__attachment-item__size">0.00MB</span></span></span></a>`;

const r = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: STORY,
  description: `<p>内嵌文件验证（开放API复刻）：</p>${anchor}`, author: '徐昭',
});
console.log('评论:', JSON.stringify(r?.data?.Comment ?? r?.data ?? r).slice(0, 700));
