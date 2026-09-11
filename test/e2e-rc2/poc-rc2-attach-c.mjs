// 变体C：全 data 属性、零内嵌 spans——验证真正的最小模板
import TapdSdk from '@opentapd/tapd-node-sdk';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const r = await sdk.addComment({
  workspace_id: W, entry_type: 'stories', entry_id: '1139814312001001533',
  description: `<p>附件最小形态C-属性全无spans：</p><a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="text" data-name="comment-embed.txt" data-size="62" target="_blank" rel="noopener" href="/${W}/attachments/preview_attachments/1139814312001000004/story_description_attachment">comment-embed.txt</a>`,
  author: '徐昭',
});
console.log('C → 评论', r?.data?.Comment?.id);
