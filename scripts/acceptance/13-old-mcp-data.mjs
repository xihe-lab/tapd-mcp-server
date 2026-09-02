import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { McpClient, Reporter, OLD_MCP_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';
import { CLI_BIN } from './helpers.mjs';

// 5.4 MCP 数据级回归：v1.4.2 实构建 vs 新版同参对照（读 5 资源 + story 写交叉读回）
const r = new Reporter('13-old-mcp-data');
const token = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8')).access_token;
const AUTH_ENV = { TAPD_ACCESS_TOKEN: token, TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) };

const oldMcp = new McpClient({ env: AUTH_ENV, bin: OLD_MCP_BIN });
const newMcp = new McpClient({ env: AUTH_ENV });

async function callText(mcp, name, args) {
  const res = await mcp.callTool(name, args);
  const text = res.content?.map(c => c.text).join('') ?? '';
  if (res.isError) throw new Error(`${name} isError: ${text.slice(0, 200)}`);
  return text;
}

const reads = [
  ['story list', 'tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 3 }],
  ['story count', 'tapd_get_story_count', { workspace_id: WORKSPACE_ID }],
  ['bug list', 'tapd_get_bugs', { workspace_id: WORKSPACE_ID, limit: 3 }],
  ['bug count', 'tapd_get_bug_count', { workspace_id: WORKSPACE_ID }],
  ['task list', 'tapd_get_tasks', { workspace_id: WORKSPACE_ID, limit: 3 }],
  ['task count', 'tapd_get_task_count', { workspace_id: WORKSPACE_ID }],
  ['iteration list', 'tapd_get_iterations', { workspace_id: WORKSPACE_ID, limit: 3 }],
  ['iteration count', 'tapd_get_iteration_count', { workspace_id: WORKSPACE_ID }],
  ['wiki list', 'tapd_get_wikis', { workspace_id: WORKSPACE_ID, limit: 3 }],
  ['wiki count', 'tapd_get_wiki_count', { workspace_id: WORKSPACE_ID }],
  ['story 单实体', 'tapd_get_stories', { workspace_id: WORKSPACE_ID, id: '1139814312001001299', fields: 'id,name,status,owner' }],
];

const cleanup = [];
try {
  await oldMcp.start();
  await newMcp.start();

  for (const [label, name, args] of reads) {
    const run = async () => Promise.all([callText(oldMcp, name, args), callText(newMcp, name, args)]);
    let [a, b] = await run();
    if (a !== b) {
      await new Promise(s => setTimeout(s, 2000));
      [a, b] = await run();
    }
    const brief = a === b ? '' : `旧 ${a.length}B vs 新 ${b.length}B, 首差异位 ${[...a].findIndex((c, i) => c !== b[i])}`;
    r.check(`新旧 MCP 数据字节级一致: ${label}`, a === b, brief);
  }

  // 写交叉：旧版建 → 新版读回；新版建 → 旧版读回（create 响应比对实体 key 集与 name）
  const STAMP = Date.now();
  for (const [side, mcp, other, name] of [['旧', oldMcp, newMcp, 'old'], ['新', newMcp, oldMcp, 'new']]) {
    const sName = `zzz-delete-me-${name}-mcp-story-${STAMP}`;
    const created = JSON.parse(await callText(mcp, 'tapd_create_story', { workspace_id: WORKSPACE_ID, name: sName }));
    const id = created?.Story?.id;
    r.check(`${side}版 MCP create story 成功 (id=${id})`, Boolean(id));
    if (!id) continue;
    cleanup.push(`story:${id}`);
    const upd = JSON.parse(await callText(mcp, 'tapd_update_story', { id, name: `${sName}-upd`, workspace_id: WORKSPACE_ID }));
    r.check(`${side}版 MCP update story 回显 -upd (key 集 ${Object.keys(upd?.Story ?? {}).length})`, (upd?.Story?.name ?? '').endsWith('-upd') && Object.keys(upd?.Story ?? {}).length > 0);
    const seen = JSON.parse(await callText(other, 'tapd_get_stories', { workspace_id: WORKSPACE_ID, id, fields: 'id,name' }));
    const row = Array.isArray(seen) ? seen[0]?.Story : seen?.Story;
    r.check(`${side}版写入对侧 MCP 读回可见 (跨版本写可见性)`, row?.name === `${sName}-upd`, `读到: ${String(row?.name).slice(0, 80)}`);
  }

  // 新旧 create 响应结构一致性：各自再建一只，比对返回 Story key 集
  const a = JSON.parse(await callText(oldMcp, 'tapd_create_story', { workspace_id: WORKSPACE_ID, name: `zzz-delete-me-old-struct-${STAMP}` }));
  const b = JSON.parse(await callText(newMcp, 'tapd_create_story', { workspace_id: WORKSPACE_ID, name: `zzz-delete-me-new-struct-${STAMP}` }));
  const keysA = Object.keys(a.Story ?? {}).sort().join(',');
  const keysB = Object.keys(b.Story ?? {}).sort().join(',');
  r.check('新旧 create 响应 Story key 集一致', keysA.length > 0 && keysA === keysB, `keys=${keysA.slice(0, 80)}`);
  cleanup.push(`story:${a?.Story?.id}`, `story:${b?.Story?.id}`);
} catch (e) {
  r.check('5.4 新旧 MCP 数据对照执行', false, e.message.slice(0, 300));
} finally {
  oldMcp.stop();
  newMcp.stop();
}
r.note(`测试数据（留人工清理，前缀 zzz-delete-me-）: ${cleanup.join(', ')}`);
const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
