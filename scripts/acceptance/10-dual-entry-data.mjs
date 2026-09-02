import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { McpClient, Reporter, CLI_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';

// 凭证纪律：token 仅在进程内从 config.json 读出注入子进程 env，不打印明文
function readToken() {
  const config = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8'));
  if (!config.access_token) throw new Error('config.json 无 access_token');
  return config.access_token;
}
export const TOKEN = readToken();
export const AUTH_ENV = {
  TAPD_ACCESS_TOKEN: TOKEN,
  TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID),
};

const r = new Reporter('10-dual-entry-data');
const STAMP = Date.now();
const START_DATE = new Date().toISOString().slice(0, 10);
const END_DATE = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
const CREATOR = '徐昭';
const mcp = new McpClient({ env: AUTH_ENV });

async function cliJson(...args) {
  const res = await runCmd('node', [CLI_BIN, ...args], { env: { TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) } });
  if (res.code !== 0) throw new Error(`CLI 失败 (${args.join(' ')}): exit=${res.code} ${res.stderr.slice(0, 150)}`);
  return res.stdout;
}

async function mcpJson(name, args) {
  const res = await mcp.callTool(name, args);
  const text = res.content?.map(c => c.text).join('') ?? '';
  if (res.isError) throw new Error(`MCP ${name} isError: ${text.slice(0, 200)}`);
  return text;
}

async function diffRead(label, cliArgs, mcpName, mcpArgs) {
  const run = async () => {
    const [a, b] = await Promise.all([cliJson(...cliArgs), mcpJson(mcpName, mcpArgs)]);
    return [a, b];
  };
  let [a, b] = await run();
  if (a !== b) {
    await new Promise(s => setTimeout(s, 2000));
    [a, b] = await run();
  }
  // CLI stdout 带 POSIX 惯例尾换行；剥去后与 MCP content 比对
  const cliBody = a.replace(/\n$/, '');
  const match = cliBody === b;
  r.check(`尾换行恰好 1 个: ${label}`, /\n$/.test(a) && !/\n\n$/.test(a));
  const brief = match ? '' : `CLI ${a.length}B vs MCP ${b.length}B, 首个差异位: ${[...a].findIndex((c, i) => c !== b[i])}`;
  r.check(`双入口数据一致 (剥尾换行后字节级): ${label}`, match, brief);
  return match;
}

try {
  await mcp.start();

  // ===== 5.1 只读：5 资源 × 3 读（list / count / 单实体）=====
  const reads = [
    ['story', ['story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '3', '--output', 'json'], 'tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 3 }],
    ['story count', ['story', 'count', '--workspace-id', String(WORKSPACE_ID), '--output', 'json'], 'tapd_get_story_count', { workspace_id: WORKSPACE_ID }],
    ['bug', ['bug', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '3', '--output', 'json'], 'tapd_get_bugs', { workspace_id: WORKSPACE_ID, limit: 3 }],
    ['bug count', ['bug', 'count', '--workspace-id', String(WORKSPACE_ID), '--output', 'json'], 'tapd_get_bug_count', { workspace_id: WORKSPACE_ID }],
    ['task', ['task', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '3', '--output', 'json'], 'tapd_get_tasks', { workspace_id: WORKSPACE_ID, limit: 3 }],
    ['task count', ['task', 'count', '--workspace-id', String(WORKSPACE_ID), '--output', 'json'], 'tapd_get_task_count', { workspace_id: WORKSPACE_ID }],
    ['iteration', ['iteration', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '3', '--output', 'json'], 'tapd_get_iterations', { workspace_id: WORKSPACE_ID, limit: 3 }],
    ['iteration count', ['iteration', 'count', '--workspace-id', String(WORKSPACE_ID), '--output', 'json'], 'tapd_get_iteration_count', { workspace_id: WORKSPACE_ID }],
    ['wiki', ['wiki', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '3', '--output', 'json'], 'tapd_get_wikis', { workspace_id: WORKSPACE_ID, limit: 3 }],
    ['wiki count', ['wiki', 'count', '--workspace-id', String(WORKSPACE_ID), '--output', 'json'], 'tapd_get_wiki_count', { workspace_id: WORKSPACE_ID }],
  ];
  for (const [label, cliArgs, mName, mArgs] of reads) {
    await diffRead(label, cliArgs, mName, mArgs);
  }

  // ===== 单实体读（用 story list 第一只的 id）=====
  const firstList = JSON.parse(await cliJson('story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '1', '--output', 'json'));
  const firstId = firstList?.[0]?.Story?.id;
  if (firstId) {
    await diffRead(`story 单实体 id=${firstId}`,
      ['story', 'list', '--workspace-id', String(WORKSPACE_ID), '--id', String(firstId), '--output', 'json'],
      'tapd_get_stories', { workspace_id: WORKSPACE_ID, id: String(firstId) });
  } else {
    r.note('story list 为空，跳过单实体读');
  }

  // ===== 5.1 写链路：每资源 CLI 与 MCP 各建一只，交叉读回 diff =====
  const writeTargets = [
    { res: 'story', cliCmd: 'story', cliNameFlag: 'name', listTool: 'tapd_get_stories', mcpCreate: 'tapd_create_story', mcpUpdate: 'tapd_update_story', nameKey: 'name', entityKey: 'Story' },
    { res: 'bug', cliCmd: 'bug', cliNameFlag: 'title', listTool: 'tapd_get_bugs', mcpCreate: 'tapd_create_bug', mcpUpdate: 'tapd_update_bug', nameKey: 'title', entityKey: 'Bug' },
    { res: 'task', cliCmd: 'task', cliNameFlag: 'name', listTool: 'tapd_get_tasks', mcpCreate: 'tapd_create_task', mcpUpdate: 'tapd_update_task', nameKey: 'name', entityKey: 'Task' },
    { res: 'iteration', cliCmd: 'iteration', cliNameFlag: 'name', listTool: 'tapd_get_iterations', mcpCreate: 'tapd_create_iteration', mcpUpdate: 'tapd_update_iteration', nameKey: 'name', entityKey: 'Iteration',
      extraCli: ['--startdate', START_DATE, '--enddate', END_DATE, '--creator', CREATOR], extraMcp: { startdate: START_DATE, enddate: END_DATE, creator: CREATOR } },
  ];
  const created = [];
  for (const t of writeTargets) {
    try {
      // CLI 建一只
      const cliName = `zzz-delete-me-cli-${t.res}-${STAMP}`;
      const cliCreateOut = await cliJson(t.cliCmd, 'create', `--${t.cliNameFlag}`, cliName, ...(t.extraCli ?? []), '--workspace-id', String(WORKSPACE_ID), '--output', 'json');
      const cliEntity = JSON.parse(cliCreateOut);
      const cliId = cliEntity?.[t.entityKey]?.id;
      r.check(`${t.res}: CLI create 成功 (id=${cliId})`, Boolean(cliId));
      if (cliId) created.push({ res: t.res, id: cliId, name: cliName });

      // MCP 建一只
      const mcpName = `zzz-delete-me-mcp-${t.res}-${STAMP}`;
      const createArgs = { workspace_id: WORKSPACE_ID, [t.nameKey]: mcpName, ...(t.extraMcp ?? {}) };
      const mcpCreateOut = await mcpJson(t.mcpCreate, createArgs);
      const mcpEntity = JSON.parse(mcpCreateOut);
      const mcpId = mcpEntity?.[t.entityKey]?.id;
      r.check(`${t.res}: MCP create 成功 (id=${mcpId})`, Boolean(mcpId));
      if (mcpId) created.push({ res: t.res, id: mcpId, name: mcpName });

      // 交叉读回 diff：CLI 读 MCP 建的、MCP 读 CLI 建的
      if (cliId && mcpId) {
        await diffRead(`${t.res} 交叉读回 (CLI←MCP实体 id=${mcpId})`,
          [t.cliCmd, 'list', '--workspace-id', String(WORKSPACE_ID), '--id', String(mcpId), '--output', 'json'],
          t.listTool, { workspace_id: WORKSPACE_ID, id: String(mcpId) });
      }
    } catch (e) {
      r.check(`${t.res}: 写链路执行`, false, e.message.slice(0, 250));
    }
  }

  // update 双入口（story：CLI 更新 CLI 那只、MCP 更新 MCP 那只，比对响应结构）
  const cliStory = created.find(c => c.res === 'story' && c.name.includes('-cli-'));
  const mcpStory = created.find(c => c.res === 'story' && c.name.includes('-mcp-'));
  if (cliStory && mcpStory) {
    try {
      const cliUpd = await cliJson('story', 'update', cliStory.id, '--name', `${cliStory.name}-upd`, '--workspace-id', String(WORKSPACE_ID), '--output', 'json');
      const mcpUpd = await mcpJson('tapd_update_story', { id: mcpStory.id, name: `${mcpStory.name}-upd`, workspace_id: WORKSPACE_ID });
      const a = JSON.parse(cliUpd);
      const b = JSON.parse(mcpUpd);
      const keysA = Object.keys(a.Story ?? {}).sort().join(',');
      const keysB = Object.keys(b.Story ?? {}).sort().join(',');
      r.check('story update 双入口响应结构一致 (Story key 集相同)', keysA === keysB && keysA.length > 0,
        `CLI keys=${keysA.slice(0, 80)} | MCP keys=${keysB.slice(0, 80)}`);
      r.check('story update 双入口回显 name 语义一致', (a.Story?.name ?? '').endsWith('-upd') && (b.Story?.name ?? '').endsWith('-upd'),
        `CLI: ${a.Story?.name} | MCP: ${b.Story?.name}`);
    } catch (e) {
      r.check('story update 双入口比对', false, e.message.slice(0, 250));
    }
  }

  r.note(`测试数据（无实体删除工具，留人工清理，前缀 zzz-delete-me-）: ${created.map(c => `${c.res}:${c.id}`).join(', ')}`);
} catch (e) {
  r.check('第二层数据一致性执行', false, e.message.slice(0, 300));
} finally {
  mcp.stop();
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
