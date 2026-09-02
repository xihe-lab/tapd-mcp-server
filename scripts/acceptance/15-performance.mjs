import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { McpClient, Reporter, OLD_MCP_BIN, WORKSPACE_ID } from './helpers.mjs';

// 5.6 MCP 性能零退化：v1.4.2 vs 新版同参数 story list 各 5 次取中位
const r = new Reporter('15-performance');
const token = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8')).access_token;
const AUTH_ENV = { TAPD_ACCESS_TOKEN: token, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) };
const ARGS = { workspace_id: WORKSPACE_ID, limit: 3 };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const oldMcp = new McpClient({ env: AUTH_ENV, bin: OLD_MCP_BIN });
const newMcp = new McpClient({ env: AUTH_ENV });
try {
  await oldMcp.start();
  await newMcp.start();
  // 预热各 1 次（连接建立、首页 RTT）
  await oldMcp.callTool('tapd_get_stories', ARGS);
  await newMcp.callTool('tapd_get_stories', ARGS);

  const samples = { old: [], new: [] };
  for (let i = 0; i < 5; i++) {
    let t0 = performance.now();
    const a = await oldMcp.callTool('tapd_get_stories', ARGS);
    samples.old.push(performance.now() - t0);
    if (a.isError) throw new Error(`旧版 call isError`);
    t0 = performance.now();
    const b = await newMcp.callTool('tapd_get_stories', ARGS);
    samples.new.push(performance.now() - t0);
    if (b.isError) throw new Error(`新版 call isError`);
  }
  const mOld = median(samples.old);
  const mNew = median(samples.new);
  r.note(`旧版 5 次: ${samples.old.map(t => t.toFixed(0)).join('/')}ms, 中位 ${mOld.toFixed(0)}ms`);
  r.note(`新版 5 次: ${samples.new.map(t => t.toFixed(0)).join('/')}ms, 中位 ${mNew.toFixed(0)}ms`);
  r.check(`性能零退化: 新版中位 ${mNew.toFixed(0)}ms ≤ 旧版中位 ${mOld.toFixed(0)}ms × 2 且差值 <150ms`,
    mNew <= mOld * 2 && mNew - mOld < 150);
} catch (e) {
  r.check('5.6 性能对照执行', false, e.message.slice(0, 300));
} finally {
  oldMcp.stop();
  newMcp.stop();
}
const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
