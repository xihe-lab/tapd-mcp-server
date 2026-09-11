import TapdSdk from '@opentapd/tapd-node-sdk';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const r = await sdk.downloadAttachment({ workspace_id: process.env.TAPD_DEFAULT_WORKSPACE_ID, id: '1139814312001000004' });
const url = r?.data?.Attachment?.download_url;
console.log('URL 域名:', new URL(url).host);
const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
console.log('HTTP', res.status, '| 字节数', buf.length, '| sha1 前8:', (await import('node:crypto')).createHash('sha1').update(buf).digest('hex').slice(0, 8));
console.log('内容:', buf.toString('utf8').slice(0, 60));
