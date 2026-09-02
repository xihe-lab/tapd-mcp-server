import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { Reporter, CLI_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';

// 5.5 凭证脱敏抽查：config show 脱敏、verbose 日志不泄 token、config 文件权限、MCP 无凭证面
const r = new Reporter('14-credential-masking');
const token = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8')).access_token;
const tail4 = String(token).slice(-4);
const cfgEnv = { TAPD_CONFIG_PATH: `${homedir()}/.tapd/config.json` };

// 1) td config show 不含明文 token，且以掩码形式呈现尾4位
const show = await runCmd('node', [CLI_BIN, 'config', 'show'], { env: cfgEnv });
const showOut = show.stdout + show.stderr;
r.check('td config show 不含明文 token', show.code === 0 && !showOut.includes(token), `exit=${show.code}`);
const masked = showOut.includes(`***${tail4}`) || showOut.includes(`****${tail4}`) || /\*{2,}/.test(showOut);
r.check(`td config show 掩码呈现 (含 *** 且尾4位 ${tail4} 可辨)`, masked, showOut.split('\n').find(l => /token/i.test(l))?.slice(0, 80));

// 2) verbose 模式请求日志不泄 token（真实 API 调用）
const v = await runCmd('node', [CLI_BIN, 'story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '1', '-v', '--output', 'json'], { env: cfgEnv });
const vAll = v.stdout + v.stderr;
r.check('td story list -v 全输出不含明文 token', v.code === 0 && !vAll.includes(token), `exit=${v.code} 输出 ${vAll.length}B`);

// 3) config.json 权限 600
const mode = (statSync(`${homedir()}/.tapd/config.json`).mode & 0o777).toString(8);
r.check('~/.tapd/config.json 权限 600', mode === '600', `实际 ${mode}`);

// 4) MCP 面：tools/list 不含 config/凭证类工具
{
  const probe = await runCmd('node', ['--input-type=module', '-e', `
    import { McpClient } from './scripts/acceptance/helpers.mjs';
    const mcp = new McpClient({ env: { TAPD_ACCESS_TOKEN: 'dummy-not-real' } });
    await mcp.start();
    const tools = await mcp.listTools();
    await mcp.stop();
    const names = tools.map(t => t.name);
    const suspicious = names.filter(n => /credential|access.?token|secret|password|api.?key/i.test(n));
    console.log(JSON.stringify({ total: names.length, suspicious }));
  `], { env: {} });
  let info = null;
  try { info = JSON.parse(probe.stdout.trim().split('\n').pop()); } catch { /* noop */ }
  r.check('MCP tools/list 无 config/token/credential 类工具 (凭证不暴露为工具)', info && info.total === 210 && info.suspicious.length === 0,
    JSON.stringify(info ?? probe.stderr.slice(0, 120)));
}
const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
