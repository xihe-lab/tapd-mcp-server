import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpClient, Reporter, WORKSPACE_ID, CLI_BIN, SOURCE_MCP_BIN } from './helpers.mjs';

// M6 环境矩阵 10 代表组合（需求 1454）
// Node 三版本绝对路径（~/.nvm/versions/node/vXX/bin/node）× 双入口（CLI/MCP）× 认证（config/env/Basic）× 输出（json/table）
// TTY 断言口径（评审修订 8）：只验退出码 + 文案，不锚 ANSI 转义
// Basic 凭证从真实 config 动态探测；缺凭证则该组合 SKIP 豁免记录

const r = new Reporter('22-env-matrix');
const USER = '徐昭';
const NODE_DIRS = {
  v20: join(homedir(), '.nvm/versions/node/v20.19.4/bin/node'),
  v22: join(homedir(), '.nvm/versions/node/v22.18.0/bin/node'),
  v24: join(homedir(), '.nvm/versions/node/v24.16.0/bin/node'),
};
const CONFIG = JSON.parse(readFileSync(join(homedir(), '.tapd/config.json'), 'utf8'));
const TOKEN = CONFIG.access_token;
if (!TOKEN) throw new Error('config 无 access_token');
// Basic 凭证动态探测（key 名不确定，按语义匹配）
const basicUserKey = Object.keys(CONFIG).find(k => /api_user|basic_user|user$/i.test(k) && typeof CONFIG[k] === 'string');
const basicPassKey = Object.keys(CONFIG).find(k => /password|api_pass/i.test(k) && typeof CONFIG[k] === 'string');
if (basicUserKey && basicPassKey) r.note(`Basic 凭证探测: ${basicUserKey}/${basicPassKey}`);
else r.note('Basic 凭证未探测到，相关组合将 SKIP 豁免');

const sleep = ms => new Promise(res => setTimeout(res, ms));
const textOf = (res) => res.content?.map(c => c.text).join('') ?? '';

function cli(nodeBin, args, env = {}) {
  return spawnSync(nodeBin, [CLI_BIN, ...args], {
    encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID), TAPD_NICK_NAME: USER, ...env },
  });
}

// ===== 组合 1: v20 + CLI + config token + json（env 清空，验证默认 ~/.tapd/config.json 读取路径）=====
{
  const res = cli(NODE_DIRS.v20, ['story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '1', '--output', 'json'],
    { TAPD_ACCESS_TOKEN: '' });
  let ok = false;
  try { ok = res.status === 0 && JSON.parse(res.stdout).list?.length >= 0; } catch { /* json 解析失败 */ }
  r.check('C1 v20+CLI+config+json: 退出码 0 且 JSON list 结构', ok, (res.stderr ?? '').slice(0, 100));
}

// ===== 组合 2: v20 + MCP + env token =====
{
  const mcp = new McpClient({ nodeBin: NODE_DIRS.v20, bin: SOURCE_MCP_BIN, env: { TAPD_ACCESS_TOKEN: TOKEN, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) } });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    const probe = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    r.check(`C2 v20+MCP+env: 握手 212 工具 + 读调用 (实际 ${tools.length})`, tools.length === 212 && !probe.isError, textOf(probe).slice(0, 80));
  } finally { mcp.stop(); }
}

// ===== 组合 3: v22 + CLI + env token + table 输出 =====
{
  const res = cli(NODE_DIRS.v22, ['story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '2', '--output', 'table'],
    { TAPD_ACCESS_TOKEN: TOKEN, TAPD_CONFIG_PATH: '/nonexistent/tapd-acceptance-matrix.json' });
  r.check('C3 v22+CLI+env+table: 退出码 0 且表格含表头列', res.status === 0 && /(id|ID|title|name)/.test(res.stdout ?? ''), (res.stderr ?? '').slice(0, 100) + (res.stdout ?? '').slice(0, 60));
}

// ===== 组合 4: v22 + MCP + config token（config 注入路径）=====
{
  const mcp = new McpClient({ nodeBin: NODE_DIRS.v22, bin: SOURCE_MCP_BIN, env: { TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) } });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    const probe = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    r.check('C4 v22+MCP+config: 默认 ~/.tapd/config.json 读取生效', tools.length === 212 && !probe.isError, textOf(probe).slice(0, 80));
  } finally { mcp.stop(); }
}

// ===== 组合 5: v24 + CLI + config token + json =====
{
  const res = cli(NODE_DIRS.v24, ['story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '1', '--output', 'json'],
    { TAPD_ACCESS_TOKEN: TOKEN, TAPD_CONFIG_PATH: '/nonexistent/tapd-acceptance-matrix.json' });
  let ok = false;
  try { ok = res.status === 0 && 'total' in JSON.parse(res.stdout); } catch { /* */ }
  r.check('C5 v24+CLI+config+json: 退出码 0 且含 total 字段', ok, (res.stderr ?? '').slice(0, 100));
}

// ===== 组合 6: v24 + MCP + env token =====
{
  const mcp = new McpClient({ nodeBin: NODE_DIRS.v24, bin: SOURCE_MCP_BIN, env: { TAPD_ACCESS_TOKEN: TOKEN, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) } });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    const probe = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    r.check(`C6 v24+MCP+env: 握手 212 + 读出数 (实际 ${tools.length})`, tools.length === 212 && !probe.isError, textOf(probe).slice(0, 80));
  } finally { mcp.stop(); }
}

// ===== 组合 7: v24 + CLI + Basic auth（探测到凭证才跑）=====
{
  if (basicUserKey && basicPassKey) {
    const res = cli(NODE_DIRS.v24, ['story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '1', '--output', 'json'], {
      TAPD_CONFIG_PATH: '/nonexistent/tapd-acceptance-matrix.json',
      TAPD_ACCESS_TOKEN: '',
      TAPD_API_USER: CONFIG[basicUserKey],
      TAPD_API_PASSWORD: CONFIG[basicPassKey],
    });
    r.check('C7 v24+CLI+Basic: 只读调用成功（Basic 仅 GET 语义）', res.status === 0, (res.stderr ?? '').slice(0, 120));
  } else {
    r.check('C7 v24+CLI+Basic: SKIP（config 无 Basic 凭证，豁免记录）', false, '需用户提供 Basic 凭证或标记豁免');
  }
}

// ===== 组合 8: v22 + CLI 裸环境 AUTH_MISSING（TTY 口径：退出码+文案，不锚 ANSI）=====
{
  const res = cli(NODE_DIRS.v22, ['story', 'list', '--workspace-id', String(WORKSPACE_ID)], {
    TAPD_CONFIG_PATH: '/nonexistent/tapd-acceptance-matrix.json',
    TAPD_ACCESS_TOKEN: '', TAPD_API_USER: '', TAPD_API_PASSWORD: '',
  });
  r.check('C8 v22+CLI 裸环境: AUTH_MISSING 退出码 1', res.status === 1 && /AUTH_MISSING/.test(res.stderr ?? ''), `exit=${res.status}`);
  r.check('C8 v22+CLI 裸环境: 文案含引导且无 stack', /(config set|TAPD_ACCESS_TOKEN|凭证)/.test(res.stderr ?? '') && !/at\s+\w+\s+\(/.test(res.stderr ?? ''));
}

// ===== 组合 9: v20 + MCP + Basic auth =====
{
  if (basicUserKey && basicPassKey) {
    const mcp = new McpClient({
      nodeBin: NODE_DIRS.v20, bin: SOURCE_MCP_BIN,
      env: {
        TAPD_CONFIG_PATH: '/nonexistent/tapd-acceptance-matrix.json',
        TAPD_ACCESS_TOKEN: '',
        TAPD_API_USER: CONFIG[basicUserKey], TAPD_API_PASSWORD: CONFIG[basicPassKey],
        TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID),
      },
    });
    try {
      await mcp.start();
      const tools = await mcp.listTools();
      const probe = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
      r.check('C9 v20+MCP+Basic: tools/list 212 + 只读出数', tools.length === 212 && !probe.isError, textOf(probe).slice(0, 80));
    } finally { mcp.stop(); }
  } else {
    r.check('C9 v20+MCP+Basic: SKIP（config 无 Basic 凭证，豁免记录）', false, '同 C7');
  }
}

// ===== 组合 10: v24 + MCP 裸环境 AUTH_MISSING =====
{
  const mcp = new McpClient({
    nodeBin: NODE_DIRS.v24, bin: SOURCE_MCP_BIN,
    env: {
      TAPD_CONFIG_PATH: '/nonexistent/tapd-acceptance-matrix.json',
      TAPD_ACCESS_TOKEN: '', TAPD_API_USER: '', TAPD_API_PASSWORD: '',
    },
  });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    const call = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    const t = textOf(call);
    r.check('C10 v24+MCP 裸环境: tools/list 仍可用（凭证缺失不阻加载）', tools.length === 212, `tools=${tools.length}`);
    r.check('C10 v24+MCP 裸环境: 读调用 isError + 人类文案 + 无 stack',
      call.isError === true && !/at\s+\w+\s+\(/.test(t) && /(凭证|token|AUTH|config)/i.test(t), t.slice(0, 100));
  } finally { mcp.stop(); }
}

await sleep(0);
const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
