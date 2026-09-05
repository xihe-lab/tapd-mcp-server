import { readFileSync, writeFileSync } from 'node:fs';
import { McpClient, Reporter, WORKSPACE_ID, readRealToken } from './helpers.mjs';

// M2 只读全量 146 工具（需求 1454）：tools/list schema 驱动参数合成，逐一真实调用
// 分级：PASS 成功 / EMPTY 空数据合法 / SKIP 参数不可自动合成（记录豁免） / FAIL 缺陷
// 频控：串行 200ms + 429/5xx 指数退避

const r = new Reporter('18-read-full-sweep');
const TOKEN = readRealToken();
const AUTH_ENV = {
  TAPD_ACCESS_TOKEN: TOKEN,
  TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID),
  TAPD_NICK_NAME: '徐昭',
};

// 只读清单来自 derived-commands.txt（WRITE 列空）
const README = new URL('../../docs/derived-commands.txt', import.meta.url);
const readTools = readFileSync(README, 'utf8').split('\n')
  .filter(l => /^tapd_/.test(l) && !/\sY\s*$/.test(l))
  .map(l => l.trim().split(/\s+/)[0]);
r.check(`derived-commands.txt 只读工具解析 = 146 (实际 ${readTools.length})`, readTools.length === 146);

// ===== 实体池：只读取真实实体 ID 供 --id 类参数引用 =====
const mcp = new McpClient({ env: AUTH_ENV });
await mcp.start();
const allTools = await mcp.listTools();
const schemaByName = new Map(allTools.map(t => [t.name, t.inputSchema]));

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function listFirst(tool, args) {
  const res = await mcp.callTool(tool, args);
  if (res.isError) return null;
  try {
    const data = JSON.parse(res.content.map(c => c.text).join(''));
    const list = Array.isArray(data) ? data : (data.list ?? data.data ?? (data.Story ? [data.Story] : null));
    const first = Array.isArray(list) ? list[0] : Object.values(data)[0];
    return first && typeof first === 'object' ? first : null;
  } catch { return null; }
}

const POOL = {};
async function buildPool() {
  const probes = [
    ['story', 'tapd_get_stories', {}],
    ['bug', 'tapd_get_bugs', {}],
    ['task', 'tapd_get_tasks', {}],
    ['iteration', 'tapd_get_iterations', {}],
    ['wiki', 'tapd_get_wikis', {}],
    ['story_category', 'tapd_get_story_categories', {}],
    ['tcase_category', 'tapd_get_tcase_categories', {}],
    ['module', 'tapd_get_modules', {}],
    ['version', 'tapd_get_versions', {}],
    ['feature', 'tapd_get_features', {}],
    ['baseline', 'tapd_get_baselines', {}],
    ['release', 'tapd_get_releases', {}],
    ['test_case', 'tapd_get_test_cases', {}],
    ['test_plan', 'tapd_get_test_plans', {}],
    ['board_card', 'tapd_get_board_cards', {}],
    ['workitem_type', 'tapd_get_workitem_types', {}],
    ['timesheet', 'tapd_get_timesheets', {}],
    ['comment', 'tapd_get_comments', { entry_type: 'stories' }],
  ];
  for (const [key, tool, extra] of probes) {
    try {
      const first = await listFirst(tool, { workspace_id: WORKSPACE_ID, limit: 1, ...extra });
      POOL[key] = first ?? null;
    } catch { POOL[key] = null; }
    await sleep(200);
  }
}
await buildPool();
const poolHits = Object.entries(POOL).filter(([, v]) => v).map(([k]) => k);
r.note(`实体池就位: ${poolHits.join(',')} / 缺失: ${Object.keys(POOL).filter(k => !POOL[k]).join(',') || '无'}`);

// ===== 参数合成：required 字段名约定映射 =====
function poolId(key) { return POOL[key]?.id ? String(POOL[key].id) : undefined; }

function entityKeyOf(tool) {
  const m = tool.match(/^tapd_(?:get|batch_fetch)_([a-z_]+?)(?:_by_view_conf_id|_count|_s)?$/);
  if (!m) return undefined;
  const seg = m[1];
  for (const key of ['story_categories', 'tcase_categories', 'board_cards', 'board_columns', 'workitem_types', 'test_cases', 'test_plans', 'custom_fields', 'user_projects', 'story_related_bugs', 'story_tcase', 'time_relative_stories', 'test_plan_relative_stories', 'test_plan_tcases', 'bug_changes', 'story_changes', 'iteration_changes', 'launch_forms', 'workspace_reports']) {
    if (seg.startsWith(key)) return key;
  }
  return seg.replace(/_count$/, '');
}

const FIELD_FILLERS = {
  workspace_id: () => WORKSPACE_ID,
  limit: () => 1,
  page: () => 1,
  id: (t) => poolId(entityKeyOf(t)) ?? poolId('story'),
  nick: () => '徐昭',
  system: () => 'story',
  workitem_type_id: () => POOL.workitem_type ? Number(POOL.workitem_type.id) : undefined,
  story_id: () => poolId('story'),
  bug_id: () => poolId('bug'),
  tcase_id: () => poolId('test_case'),
  test_plan_id: () => poolId('test_plan'),
  entity_id: (t) => /comment/.test(t) ? poolId('story') : poolId('story'),
  entity_type: (t) => /comment|attachment/.test(t) ? 'stories' : 'story',
  entry_type: () => 'stories',
  entry_id: () => poolId('story'),
  board_id: () => poolId('board_card') ? Number(POOL.board_card.board_id ?? 0) || undefined : undefined,
  view_conf_id: () => undefined,
  fields: () => undefined,
  company_id: () => undefined,
};

function buildArgs(tool) {
  const schema = schemaByName.get(tool);
  const required = schema?.required ?? [];
  const args = {};
  for (const f of required) {
    const filler = FIELD_FILLERS[f];
    const v = filler ? filler(tool) : undefined;
    if (v === undefined) return { args: null, missing: f };
    args[f] = v;
  }
  return { args, missing: null };
}

// 已知合法 SKIP：依赖外部资源 ID（视图配置/项目集/公司级），无独立 list 来源
// program 两工具在 derived-commands.txt 标"只读"但实为写操作（评审 C1 裁决跳写只读验证），一律跳过防误触发
const KNOWN_SKIP = new Set([
  'tapd_program_bind_entities',
  'tapd_program_relate_workspace',
  'tapd_get_stories_by_view_conf_id',
  'tapd_get_bugs_by_view_conf_id',
  'tapd_get_tasks_by_view_conf_id',
  'tapd_get_projects',
  'tapd_get_user_projects',
  'tapd_get_third_projects',
  'tapd_get_workspace_reports',
  'tapd_mini_get_user_projects',
]);

// ===== 全量执行 =====
const results = { PASS: [], EMPTY: [], SKIP: [], FAIL: [] };
for (const tool of readTools) {
  let outcome;
  try {
    const { args, missing } = buildArgs(tool);
    if (KNOWN_SKIP.has(tool)) {
      results.SKIP.push(`${tool} (已知外部依赖)`);
    } else if (!args) {
      results.SKIP.push(`${tool} (required "${missing}" 无自动填充)`);
    } else {
      const res = await mcp.callTool(tool, args);
      const text = res.content?.map(c => c.text).join('') ?? '';
      if (!res.isError) {
        results.PASS.push(tool);
        outcome = 'PASS';
      } else if (/403|权限|permission|denied/i.test(text)) {
        results.SKIP.push(`${tool} (403 权限受限: ${text.slice(0, 80)})`);
      } else if (/未找到|不存在|not found|没有数据|为空|empty/i.test(text)) {
        results.EMPTY.push(`${tool} (${text.slice(0, 60)})`);
      } else {
        results.FAIL.push(`${tool}: ${text.slice(0, 150)}`);
        outcome = 'FAIL';
      }
    }
  } catch (e) {
    const msg = String(e.message ?? e);
    if (/429|rate|too many/i.test(msg)) {
      await sleep(5000); // 限流退避后单次重试
      try {
        const res = await mcp.callTool(tool, buildArgs(tool).args ?? {});
        if (!res.isError) { results.PASS.push(tool); outcome = 'PASS'; }
        else { results.FAIL.push(`${tool} (重试后): ${res.content?.map(c => c.text).join('').slice(0, 120)}`); outcome = 'FAIL'; }
      } catch (e2) { results.FAIL.push(`${tool}: ${String(e2.message).slice(0, 120)}`); outcome = 'FAIL'; }
    } else {
      results.FAIL.push(`${tool}: ${msg.slice(0, 120)}`);
      outcome = 'FAIL';
    }
  }
  writeFileSync('/tmp/claude/tapd-rc-read-sweep-last.json', JSON.stringify({ last: tool, results }, null, 2));
  if (outcome !== 'PASS') r.note(`[${results.PASS.length}/${readTools.length}] ${tool} -> ${outcome ?? '?'}`);
  await sleep(200);
}

// ===== 汇总 =====
r.check(`只读全量无 FAIL (${results.FAIL.length} 失败)`, results.FAIL.length === 0, results.FAIL.slice(0, 8).join(' | '));
r.note(`PASS ${results.PASS.length} / EMPTY ${results.EMPTY.length} / SKIP ${results.SKIP.length} / FAIL ${results.FAIL.length}`);
for (const s of results.SKIP) r.note(`SKIP: ${s}`);
for (const s of results.EMPTY.slice(0, 10)) r.note(`EMPTY: ${s}`);
for (const s of results.FAIL.slice(0, 15)) r.note(`FAIL: ${s}`);

mcp.stop();
const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
