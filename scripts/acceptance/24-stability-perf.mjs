import { McpClient, Reporter, WORKSPACE_ID, OLD_MCP_BIN, CLI_BIN, readRealToken } from './helpers.mjs';

// M8 性能与稳定性（需求 1454）
// - CLI 冷启动（--version 无网络）10 轮：P50 ≤300ms / Max ≤500ms
// - MCP get_stories 中位延迟：rc vs 1.4.2 实构建（/tmp/claude/tapd-v142，评审修订 1）×1.5 阈值
// - 并发 5 client × 10 轮 = 50 调用零失败；长会话 30 轮混合读零失败
// - 429 出现时断言文案明确（限流非稳定复现，出现才断言）

const r = new Reporter('24-stability-perf');
const STAMP = Date.now();
const AUTH = { TAPD_ACCESS_TOKEN: readRealToken(), TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID), TAPD_NICK_NAME: '徐昭' };
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

const textOf = (res) => res.content?.map(c => c.text).join('') ?? '';
const sleep = ms => new Promise(res => setTimeout(res, ms));

// ===== 1. CLI 冷启动 =====
{
  const { spawn } = await import('node:child_process');
  const times = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await new Promise((resolve) => {
      const p = spawn(process.execPath, [CLI_BIN, '--version'], { stdio: 'ignore' });
      p.on('close', resolve);
      p.on('error', resolve);
    });
    times.push(Math.round(performance.now() - t0));
  }
  const p50 = median(times);
  const max = Math.max(...times);
  r.note(`CLI 冷启动样本: ${times.join(',')} (ms)`);
  r.check(`CLI 冷启动 P50 ${p50}ms ≤300ms`, p50 <= 300);
  r.check(`CLI 冷启动 Max ${max}ms ≤500ms`, max <= 500);
}

// ===== 2. MCP 读性能对照（rc vs 1.4.2 实构建）=====
let rcMedian = null;
const rc = new McpClient({ env: AUTH });
await rc.start();
{
  await rc.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 }); // 预热
  const times = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const res = await rc.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    times.push(Math.round(performance.now() - t0));
    if (res.isError) r.note(`rc 预热后第 ${i} 轮 isError: ${textOf(res).slice(0, 60)}`);
    await sleep(150);
  }
  rcMedian = median(times);
  r.note(`rc get_stories 样本中位 ${rcMedian}ms: ${times.join(',')}`);
}

let v142Median = null;
if (await import('node:fs').then(fs => fs.existsSync(OLD_MCP_BIN))) {
  const old = new McpClient({ bin: OLD_MCP_BIN, env: AUTH });
  try {
    await old.start();
    await old.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    const times = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await old.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
      times.push(Math.round(performance.now() - t0));
      await sleep(150);
    }
    v142Median = median(times);
    r.note(`1.4.2 get_stories 样本中位 ${v142Median}ms: ${times.join(',')}`);
  } catch (e) {
    r.note(`1.4.2 对照启动/调用失败（基线不可用）: ${String(e.message).slice(0, 80)}`);
  } finally { old.stop(); }
} else {
  r.note(`1.4.2 对照构建缺失 (${OLD_MCP_BIN})，用历史常量基线 159ms（2026-04 实测）`);
}
const baseline = v142Median ?? 159;
const ratio = rcMedian / baseline;
r.check(`rc 中位 ${rcMedian}ms ≤ 基线 ${baseline}ms ×1.5（实际 ×${ratio.toFixed(2)}）`, ratio <= 1.5);

// ===== 3. 并发稳定性 5×10 =====
{
  const clients = [];
  for (let i = 0; i < 5; i++) clients.push(new McpClient({ env: AUTH }));
  await Promise.all(clients.map(c => c.start()));
  let ok = 0, fail = 0;
  const errors = [];
  await Promise.all(clients.map(async (c) => {
    for (let i = 0; i < 10; i++) {
      try {
        const res = await c.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
        if (!res.isError) ok++; else { fail++; errors.push(textOf(res).slice(0, 60)); }
      } catch (e) { fail++; errors.push(String(e.message).slice(0, 60)); }
      await sleep(50);
    }
  }));
  r.check(`并发 5×10=50 调用零失败（成功 ${ok}）`, fail === 0, errors.slice(0, 3).join(' | '));
  const alive = clients.every(c => c.proc && c.proc.exitCode === null);
  r.check('并发期间 5 个 client 进程全部存活', alive);
  for (const c of clients) c.stop();
}

// ===== 4. 长会话 30 轮混合读 =====
{
  const rotate = [
    ['tapd_get_stories', {}],
    ['tapd_get_bugs', {}],
    ['tapd_get_iterations', {}],
    ['tapd_get_workitem_types', {}],
  ];
  let fail = 0;
  const errors = [];
  for (let i = 0; i < 30; i++) {
    const [tool, extra] = rotate[i % rotate.length];
    try {
      const res = await rc.callTool(tool, { workspace_id: WORKSPACE_ID, limit: 1, ...extra });
      if (res.isError) { fail++; errors.push(`${tool}: ${textOf(res).slice(0, 50)}`); }
    } catch (e) { fail++; errors.push(`${tool}: ${String(e.message).slice(0, 50)}`); }
    await sleep(120);
  }
  r.check(`长会话 30 轮混合读零失败（失败 ${fail}）`, fail === 0, errors.slice(0, 3).join(' | '));
}

// ===== 5. 快速连发限流观测 =====
{
  let rateLimited = 0;
  let otherFail = 0;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await rc.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
      if (res.isError) {
        const t = textOf(res);
        if (/429|限流|too many|rate/i.test(t)) rateLimited++; else otherFail++;
        if (rateLimited === 1) r.note(`429 文案样本: ${t.slice(0, 100)}`);
      }
    } catch { otherFail++; }
  }
  r.check(`快速连发 15 次: 无非限流类失败（429 命中 ${rateLimited} 次且文案明确）`, otherFail === 0,
    rateLimited > 0 ? '' : '（未触发限流属正常）');
}

rc.stop();
const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
