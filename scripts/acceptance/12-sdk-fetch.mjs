import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { McpClient, Reporter, CLI_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';

// 5.3 SDK 路由 vs fetch 抽样：compare-sdk-fetch 18 路由 + TAPD_SDK_DISABLED=1 强制 fetch 双入口
const r = new Reporter('12-sdk-fetch');
const token = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8')).access_token;
const AUTH_ENV = { TAPD_ACCESS_TOKEN: token, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) };

// 1) compare-sdk-fetch.mjs：SDK 与 fetch 同请求字节 diff
const cmp = await runCmd('node', ['scripts/compare-sdk-fetch.mjs'], { env: AUTH_ENV, timeoutMs: 120_000 });
const passN = (cmp.stdout.match(/^PASS /gm) ?? []).length;
const failN = (cmp.stdout.match(/^FAIL /gm) ?? []).length;
r.check(`compare-sdk-fetch: ${passN} PASS / ${failN} FAIL (退出码 ${cmp.code})`, cmp.code === 0 && passN > 0 && failN === 0,
  cmp.stdout.split('\n').filter(l => l.startsWith('FAIL')).slice(0, 3).join(' | ') || cmp.stderr.slice(0, 120));

// 2) TAPD_SDK_DISABLED=1 强制纯 fetch 路径，双入口出数且一致
const fetchEnv = { ...AUTH_ENV, TAPD_SDK_DISABLED: '1' };
const mcp = new McpClient({ env: fetchEnv });
try {
  await mcp.start();
  const cliRes = await runCmd('node', [CLI_BIN, 'story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '3', '--output', 'json'], { env: fetchEnv });
  r.check('TAPD_SDK_DISABLED=1 CLI story list 出数', cliRes.code === 0 && cliRes.stdout.trim().startsWith('[') && cliRes.stdout.includes('"Story"'),
    `exit=${cliRes.code} len=${cliRes.stdout.length}`);
  const res = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 3 });
  const text = res.content?.map(c => c.text).join('') ?? '';
  r.check('TAPD_SDK_DISABLED=1 MCP tapd_get_stories 出数', !res.isError && text.includes('"Story"'), `isError=${res.isError} len=${text.length}`);
  r.check('TAPD_SDK_DISABLED=1 双入口数据一致 (剥尾换行)', cliRes.stdout.replace(/\n$/, '') === text,
    `CLI ${cliRes.stdout.length}B vs MCP ${text.length}B`);
} catch (e) {
  r.check('5.3 强制 fetch 路径执行', false, e.message.slice(0, 300));
} finally {
  mcp.stop();
}
const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
