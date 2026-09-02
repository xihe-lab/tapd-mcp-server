import { readFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { McpClient, Reporter, CLI_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';

// 5.2 OAuth 写链路：config set read_only=false + story/iteration create/update 跨入口可见性
const r = new Reporter('11-oauth-write');
const STAMP = Date.now();
const START_DATE = new Date().toISOString().slice(0, 10);
const END_DATE = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
const CREATOR = '徐昭';
const TMP_CONFIG = '/tmp/claude/acceptance-oauth-config.json';

const realConfig = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8'));
const tokenTail = String(realConfig.access_token ?? '').slice(-4);
r.check('真凭证就位 (config.json access_token)', Boolean(realConfig.access_token), `尾4位 ...${tokenTail}`);

copyFileSync(`${homedir()}/.tapd/config.json`, TMP_CONFIG);
const cfgEnv = { TAPD_CONFIG_PATH: TMP_CONFIG };

const setRo = await runCmd('node', [CLI_BIN, 'config', 'set', 'read_only=false'], { env: cfgEnv });
r.check('tapd config set read_only=false 退出码 0', setRo.code === 0, setRo.stderr.slice(0, 120));
const after = JSON.parse(readFileSync(TMP_CONFIG, 'utf8'));
r.check('config 副本 read_only=false 且 access_token 保留', after.read_only === false && Boolean(after.access_token));

const mcp = new McpClient({ env: { TAPD_ACCESS_TOKEN: realConfig.access_token, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) } });

async function cliJson(...args) {
  const res = await runCmd('node', [CLI_BIN, ...args], { env: { ...cfgEnv, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) } });
  if (res.code !== 0) throw new Error(`CLI 失败 (${args.join(' ')}): exit=${res.code} ${res.stderr.slice(0, 150)}`);
  return res.stdout;
}
async function mcpJson(name, args) {
  const res = await mcp.callTool(name, args);
  const text = res.content?.map(c => c.text).join('') ?? '';
  if (res.isError) throw new Error(`MCP ${name} isError: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const cleanup = [];
try {
  await mcp.start();

  // story：CLI 建 → CLI 更新 → MCP 读回见新名
  const sName = `zzz-delete-me-cli-oauth-story-${STAMP}`;
  const s = JSON.parse(await cliJson('story', 'create', '--name', sName, '--workspace-id', String(WORKSPACE_ID), '--output', 'json'));
  const sId = s?.Story?.id;
  r.check('story CLI create (OAuth)', Boolean(sId));
  if (sId) {
    cleanup.push(`story:${sId}`);
    const upd = JSON.parse(await cliJson('story', 'update', sId, '--name', `${sName}-upd`, '--workspace-id', String(WORKSPACE_ID), '--output', 'json'));
    r.check('story CLI update (OAuth) 回显 -upd', (upd?.Story?.name ?? '').endsWith('-upd'));
    const seen = await mcpJson('tapd_get_stories', { workspace_id: WORKSPACE_ID, id: sId });
    const seenName = Array.isArray(seen) ? seen[0]?.Story?.name : seen?.Story?.name;
    r.check('story CLI 更新后 MCP 读回可见 (跨入口写可见性)', seenName === `${sName}-upd`, `MCP 读到: ${String(seenName).slice(0, 80)}`);
  }

  // story：MCP 建 → MCP 更新 → CLI 读回见新名
  const mName = `zzz-delete-me-mcp-oauth-story-${STAMP}`;
  const ms = await mcpJson('tapd_create_story', { workspace_id: WORKSPACE_ID, name: mName });
  const mId = ms?.Story?.id;
  r.check('story MCP create (OAuth)', Boolean(mId));
  if (mId) {
    cleanup.push(`story:${mId}`);
    const upd = await mcpJson('tapd_update_story', { id: mId, name: `${mName}-upd`, workspace_id: WORKSPACE_ID });
    r.check('story MCP update (OAuth) 回显 -upd', (upd?.Story?.name ?? '').endsWith('-upd'));
    const seen = JSON.parse(await cliJson('story', 'list', '--workspace-id', String(WORKSPACE_ID), '--id', mId, '--output', 'json'));
    const row = Array.isArray(seen) ? seen[0]?.Story : seen?.Story;
    r.check('story MCP 更新后 CLI 读回可见 (跨入口写可见性)', row?.name === `${mName}-upd`, `CLI 读到: ${String(row?.name).slice(0, 80)}`);
  }

  // iteration：CLI 建 (creator+dates) → CLI 更新 → MCP 读回见新名
  const iName = `zzz-delete-me-cli-oauth-iter-${STAMP}`;
  const it = JSON.parse(await cliJson('iteration', 'create', '--name', iName, '--startdate', START_DATE, '--enddate', END_DATE, '--creator', CREATOR, '--workspace-id', String(WORKSPACE_ID), '--output', 'json'));
  const iId = it?.Iteration?.id;
  r.check('iteration CLI create (OAuth, creator+dates)', Boolean(iId));
  if (iId) {
    cleanup.push(`iteration:${iId}`);
    const upd = JSON.parse(await cliJson('iteration', 'update', iId, '--name', `${iName}-upd`, '--current-user', CREATOR, '--workspace-id', String(WORKSPACE_ID), '--output', 'json'));
    r.check('iteration CLI update (OAuth) 回显 -upd', (upd?.Iteration?.name ?? '').endsWith('-upd'));
    const seen = await mcpJson('tapd_get_iterations', { workspace_id: WORKSPACE_ID, id: iId });
    const row = Array.isArray(seen) ? seen[0]?.Iteration : seen?.Iteration;
    r.check('iteration CLI 更新后 MCP 读回可见 (跨入口写可见性)', row?.name === `${iName}-upd`, `MCP 读到: ${String(row?.name).slice(0, 80)}`);
  }
} catch (e) {
  r.check('5.2 OAuth 写链路执行', false, e.message.slice(0, 300));
} finally {
  mcp.stop();
}
r.note(`测试数据（留人工清理，前缀 zzz-delete-me-）: ${cleanup.join(', ')}`);
const s2 = r.summary();
process.exit(s2.fail > 0 ? 1 : 0);
