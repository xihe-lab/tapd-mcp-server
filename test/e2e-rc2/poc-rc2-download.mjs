// PoC：SDK downloadAttachment（/attachments/down，scope attachment#r）真机验证
import TapdSdk from '@opentapd/tapd-node-sdk';
import fs from 'node:fs';
const sdk = new TapdSdk({ accessToken: process.env.TAPD_ACCESS_TOKEN });
const W = process.env.TAPD_DEFAULT_WORKSPACE_ID;
try {
  const r = await sdk.downloadAttachment({ workspace_id: W, id: '1139814312001000004' });
  const d = r?.data;
  console.log('status:', r?.status, '| data 类型:', typeof d, Array.isArray(d) ? `array(${d.length})` : '');
  if (typeof d === 'string') {
    console.log('内容前 80 字符:', d.slice(0, 80));
    fs.writeFileSync('/tmp/tapd-down-test.txt', d);
    console.log('已写 /tmp/tapd-down-test.txt，长度', d.length);
  } else {
    console.log('返回:', JSON.stringify(d)?.slice(0, 400));
  }
} catch (e) {
  console.error('失败:', e?.response?.status, JSON.stringify(e?.response?.data ?? e.message).slice(0, 300));
}
