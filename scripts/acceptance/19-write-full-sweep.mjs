import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { McpClient, Reporter, WORKSPACE_ID, readRealToken, registerOrphan, expectZzz, ZZZ_PREFIX } from './helpers.mjs';

// M3 写全量 66 工具（需求 1454，评审 C1/C3/孤儿登记口径）
// - C1 黑名单：select/cascade_field_options 仅自建字段 + append_mode=1；board 依赖看板 ID；owner 一律当前用户
// - C3 前缀防御：所有 ID 型入参先查名断言 zzz-delete-me- 前缀，缺前缀立即中止（无名字实体断言其关联实体）
// - 孤儿登记：create 成功立即登记（无论后续成败），台账 /tmp/claude/tapd-rc-orphan-ledger.jsonl
// - 断点续跑：进度文件 /tmp/claude/tapd-rc-write-progress.json；请求预算 <800（含查名）

const r = new Reporter('19-write-full-sweep');
const USER = '徐昭';
const STAMP = Date.now();
const nm = (s) => `${ZZZ_PREFIX}rc19-${s}-${STAMP}`;
const PROGRESS = '/tmp/claude/tapd-rc-write-progress.json';
const BUDGET = 800;
let apiCalls = 0;

const mcp = new McpClient({
  env: { TAPD_ACCESS_TOKEN: readRealToken(), TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID), TAPD_NICK_NAME: USER },
});
await mcp.start();

const sleep = ms => new Promise(res => setTimeout(res, ms));
const textOf = (res) => res.content?.map(c => c.text).join('') ?? '';

async function call(tool, args) {
  apiCalls++;
  if (apiCalls > BUDGET) throw new Error(`请求预算超限 (${BUDGET})，中止`);
  const res = await mcp.callTool(tool, args);
  if (res.isError) throw new Error(`${tool} isError: ${textOf(res).slice(0, 180)}`);
  await sleep(1000); // 写操作串行间隔（频控）
  return JSON.parse(textOf(res));
}

function firstOf(data) {
  let node = Array.isArray(data) ? data[0] : (data?.list?.[0] ?? data?.data ?? data);
  while (node && typeof node === 'object' && !Array.isArray(node)) {
    const vals = Object.values(node);
    if (vals.length === 1 && vals[0] && typeof vals[0] === 'object') { node = vals[0]; continue; }
    break;
  }
  return node;
}

// C3 查名断言：kind → 查询工具/id字段/名字字段
const VIA_GET = {
  story: ['tapd_get_stories', 'id', 'name'],
  bug: ['tapd_get_bugs', 'id', 'title'],
  task: ['tapd_get_tasks', 'id', 'name'],
  iteration: ['tapd_get_iterations', 'id', 'name'],
  wiki: ['tapd_get_wikis', 'id', 'title'],
  story_category: ['tapd_get_story_categories', 'id', 'name'],
  tcase_category: ['tapd_get_tcase_categories', 'id', 'name'],
  module: ['tapd_get_modules', 'id', 'name'],
  version: ['tapd_get_versions', 'id', 'name'],
  feature: ['tapd_get_features', 'id', 'name'],
  baseline: ['tapd_get_baselines', 'id', 'name'],
  release: ['tapd_get_releases', 'id', 'name'],
  test_case: ['tapd_get_test_cases', 'id', 'name'],
  test_plan: ['tapd_get_test_plans', 'id', 'name'],
};

async function assertZzz(kind, id, ctx) {
  const via = VIA_GET[kind];
  if (!via) return; // 无名字实体（comment/timesheet/关系类）：其关联实体在创建时已断言
  const [tool, idField, nameField] = via;
  const data = firstOf(await call(tool, { workspace_id: WORKSPACE_ID, [idField]: String(id) }));
  expectZzz(data?.[nameField], `${ctx} ${kind}:${id}`);
}

async function createReg(tool, kind, args, nameField, irremovable = false) {
  const data = firstOf(await call(tool, args));
  const id = data?.id;
  if (!id) throw new Error(`${tool} 未返回 id`);
  const name = data?.[nameField] ?? args[nameField] ?? '';
  registerOrphan(kind, id, name, { irremovable, via: tool });
  await assertZzz(kind, id, tool);
  return data;
}

// ===== 单元注册与执行器 =====
const units = [];
const unit = (tool, fn, opts = {}) => units.push({ tool, fn, ...opts });

const completed = new Set(existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')).done ?? [] : []);
function saveProgress() {
  writeFileSync(PROGRESS, JSON.stringify({ done: [...completed], apiCalls, updated: new Date().toISOString() }, null, 2));
}
const results = { PASS: [], FAIL: [], SKIP: [] };

// ============================================================
// 前置实体（顺序依赖），全部 zzz 前缀并登记
// ============================================================
const E = {}; // 实体池

unit('前置:iteration', async () => {
  E.iter = await createReg('tapd_create_iteration', 'iteration', {
    workspace_id: WORKSPACE_ID, name: nm('iter'), startdate: '2026-09-04', enddate: '2026-09-30', creator: USER,
  }, 'name');
});

unit('前置:story×3', async () => {
  E.s1 = await createReg('tapd_create_story', 'story', {
    workspace_id: WORKSPACE_ID, name: nm('story-a'), owner: USER, description: 'rc19 前置',
  }, 'name');
  E.s2 = await createReg('tapd_create_story', 'story', { workspace_id: WORKSPACE_ID, name: nm('story-b'), owner: USER }, 'name');
  E.s3 = await createReg('tapd_create_story', 'story', { workspace_id: WORKSPACE_ID, name: nm('story-c'), owner: USER }, 'name');
});

unit('前置:bug×2', async () => {
  E.b1 = await createReg('tapd_create_bug', 'bug', {
    workspace_id: WORKSPACE_ID, title: nm('bug-a'), current_owner: USER, reporter: USER, severity: '3', priority: '3',
  }, 'title');
  E.b2 = await createReg('tapd_create_bug', 'bug', {
    workspace_id: WORKSPACE_ID, title: nm('bug-b'), current_owner: USER, reporter: USER, severity: '3', priority: '3',
  }, 'title');
});

unit('前置:task', async () => {
  E.t1 = await createReg('tapd_create_task', 'task', {
    workspace_id: WORKSPACE_ID, name: nm('task'), owner: USER, creator: USER,
  }, 'name');
});

unit('前置:wiki', async () => {
  E.wiki = await createReg('tapd_create_wiki', 'wiki', {
    workspace_id: WORKSPACE_ID, title: nm('wiki'), description: 'rc19 前置正文',
  }, 'title');
});

unit('前置:comment', async () => {
  const data = firstOf(await call('tapd_create_comment', {
    workspace_id: WORKSPACE_ID, entry_type: 'stories', entry_id: String(E.s1.id), author: USER, description: 'rc19 评论',
  }));
  E.comment = data;
  if (!data?.id) throw new Error('comment 创建失败');
  registerOrphan('comment', data.id, `on-story:${E.s1.id}`, { via: 'tapd_create_comment' });
});

unit('前置:timesheet', async () => {
  const data = firstOf(await call('tapd_create_timesheet', {
    workspace_id: WORKSPACE_ID, entity_type: 'story', entity_id: String(E.s1.id), owner: USER,
    spentdate: '2026-09-04', timespent: 1, timeremain: '0', memo: 'rc19 工时',
  }));
  E.ts = data;
  if (!data?.id) throw new Error('timesheet 创建失败');
  registerOrphan('timesheet', data.id, `on-story:${E.s1.id}`, { via: 'tapd_create_timesheet' });
});

// ---- 不可清理类（C1：每类 ≤2 条，标注 irremovable）----
unit('前置:story_category', async () => {
  E.cat = await createReg('tapd_add_story_category', 'story_category', {
    workspace_id: WORKSPACE_ID, name: nm('cat'), parent_id: '0',
  }, 'name', true);
});

unit('前置:module', async () => {
  E.mod = await createReg('tapd_add_module', 'module', { workspace_id: WORKSPACE_ID, name: nm('mod'), owner: USER }, 'name', true);
});

unit('前置:version', async () => {
  E.ver = await createReg('tapd_add_version', 'version', {
    workspace_id: WORKSPACE_ID, name: nm('ver'), owner: USER, status: 0,
  }, 'name', true);
});

unit('前置:feature', async () => {
  E.feat = await createReg('tapd_add_feature', 'feature', { workspace_id: WORKSPACE_ID, name: nm('feat'), owner: USER }, 'name', true);
});

unit('前置:baseline', async () => {
  E.bl = await createReg('tapd_add_baseline', 'baseline', {
    workspace_id: WORKSPACE_ID, name: nm('bl'), baseline_date: '2026-09-04', description: 'rc19',
  }, 'name', true);
});

// custom_field_config 不可删除配额 2 条：story 下拉 + bug 下拉各 1；级联字段因配额已满 SKIP
unit('前置:custom_field(story下拉)', async () => {
  E.cf = await createReg('tapd_add_custom_field_config', 'custom_field_config', {
    workspace_id: WORKSPACE_ID, entity_type: 'story', name: nm('cf-story'), type: 'single_select',
    options: `${ZZZ_PREFIX}opt1|${ZZZ_PREFIX}opt2`, required: 0,
  }, 'name', true);
  if (!E.cf?.id) throw new Error('story 下拉字段创建失败');
});

unit('前置:custom_field(bug下拉)', async () => {
  E.cfb = await createReg('tapd_add_custom_field_config', 'custom_field_config', {
    workspace_id: WORKSPACE_ID, entity_type: 'bug', name: nm('cf-bug'), type: 'single_select',
    options: `${ZZZ_PREFIX}bopt1|${ZZZ_PREFIX}bopt2`, required: 0,
  }, 'name', true);
  if (!E.cfb?.id) throw new Error('bug 下拉字段创建失败');
});

unit('前置:release', async () => {
  E.rel = await createReg('tapd_create_release', 'release', {
    workspace_id: WORKSPACE_ID, name: nm('rel'), owner: USER, start_date: '2026-09-04', end_date: '2026-09-30', release_date: '2026-09-30',
  }, 'name', true);
});

unit('前置:test_case', async () => {
  E.tc = await createReg('tapd_create_test_case', 'test_case', {
    workspace_id: WORKSPACE_ID, name: nm('tcase'), owner: USER, precondition: 'rc19', expectresult: '通过',
    teststeps: '[{"step":"执行","expect":"通过"}]',
  }, 'name');
});

unit('前置:test_plan', async () => {
  E.tp = await createReg('tapd_create_test_plan', 'test_plan', {
    workspace_id: WORKSPACE_ID, name: nm('plan'), owner: USER, begin: '2026-09-04', end: '2026-09-30',
  }, 'name');
});

unit('前置:tcase_category', async () => {
  E.tcc = await createReg('tapd_add_tcase_category', 'tcase_category', { workspace_id: WORKSPACE_ID, name: nm('tcc') }, 'name', true);
});

unit('前置:launch_form', async () => {
  // 模板 ID 需真实存在：从项目模板列表查询取第一个
  const tpl = firstOf(await call('tapd_get_launch_forms_templates', { workspace_id: WORKSPACE_ID }));
  if (!tpl?.id) throw new Error('SKIP: 无发布评审模板（外部依赖）');
  E.launch = await createReg('tapd_add_launch_form', 'launch_form', {
    workspace_id: WORKSPACE_ID, title: nm('launch'), template_id: String(tpl.id), owner: USER,
  }, 'title', true);
});

unit('前置:board_card', async () => {
  // 看板 ID 为外部依赖：尝试从现有 board_cards 反查；无则 SKIP
  let boardId, colId;
  try {
    const any = firstOf(await call('tapd_get_board_cards', { workspace_id: WORKSPACE_ID, limit: 1 }));
    boardId = any?.board_id; colId = any?.column_id;
  } catch { /* 无看板 */ }
  if (!boardId || !colId) throw new Error('SKIP: 无可用看板 board_id/column_id（外部依赖，记录豁免）');
  E.bc = await createReg('tapd_add_board_card', 'board_card', {
    workspace_id: WORKSPACE_ID, board_id: Number(boardId), column_id: Number(colId), name: nm('card'), owner: USER,
  }, 'name');
});

// ============================================================
// 写工具逐一用例（create 前置已在上面，本节为其余 40+ 工具）
// ============================================================
unit('tapd_update_iteration', async () => {
  await call('tapd_update_iteration', { id: String(E.iter.id), name: `${E.iter.name}-upd`, current_user: USER });
  await assertZzz('iteration', E.iter.id, 'update_iteration');
});

unit('tapd_lock_iteration', async () => {
  await call('tapd_lock_iteration', { id: String(E.iter.id), current_user: USER });
});
unit('tapd_unlock_iteration', async () => {
  await call('tapd_unlock_iteration', { id: String(E.iter.id), current_user: USER });
});

unit('tapd_update_story', async () => {
  await call('tapd_update_story', { id: String(E.s1.id), name: `${E.s1.name}-upd`, owner: USER });
  await assertZzz('story', E.s1.id, 'update_story');
});

unit('tapd_copy_story', async () => {
  await assertZzz('story', E.s2.id, 'copy_story 源'); // C3：copy 源查名
  E.s2copy = await createReg('tapd_copy_story', 'story', {
    id: String(E.s2.id), workspace_id: WORKSPACE_ID, name: nm('story-b-copy'), owner: USER,
  }, 'name');
});

unit('tapd_batch_update_stories', async () => {
  for (const s of [E.s1, E.s2]) await assertZzz('story', s.id, 'batch_update 每项'); // C3：列表每项
  await call('tapd_batch_update_stories', {
    workspace_id: WORKSPACE_ID,
    stories: JSON.stringify([{ id: String(E.s1.id), owner: USER }, { id: String(E.s2.id), owner: USER }]),
  });
});

unit('tapd_update_story_category', async () => {
  await call('tapd_update_story_category', { id: String(E.cat.id), name: `${E.cat.name}-upd` });
});

unit('tapd_change_workitem_type', async () => {
  // 切到另一类别再切回 story 原类别（闭环）
  const types = await call('tapd_get_workitem_types', { workspace_id: WORKSPACE_ID });
  const list = Array.isArray(types) ? types : types.list ?? [];
  const cur = String(E.s1.workitem_type_id ?? list.find(t => /story/i.test(t.name ?? t.english_name ?? ''))?.id ?? '');
  const other = list.find(t => String(t.id) !== cur);
  if (!other) throw new Error('SKIP: 仅单一需求类别，无第二类别可切换');
  await call('tapd_change_workitem_type', { id: String(E.s1.id), workitem_type_id: String(other.id) });
  await call('tapd_change_workitem_type', { id: String(E.s1.id), workitem_type_id: cur });
});

unit('tapd_create_story_bug', async () => {
  await assertZzz('story', E.s1.id, 'story_bug story 端');
  await assertZzz('bug', E.b1.id, 'story_bug bug 端');
  await call('tapd_create_story_bug', { workspace_id: WORKSPACE_ID, story_id: String(E.s1.id), bug_id: String(E.b1.id) });
});
unit('tapd_remove_story_bug_relations', async () => {
  await call('tapd_remove_story_bug_relations', { workspace_id: WORKSPACE_ID, story_id: String(E.s1.id), bug_id: String(E.b1.id) });
});

unit('tapd_create_story_tcase', async () => {
  await assertZzz('story', E.s1.id, 'story_tcase story 端');
  await assertZzz('test_case', E.tc.id, 'story_tcase tcase 端');
  await call('tapd_create_story_tcase', { workspace_id: WORKSPACE_ID, story_id: String(E.s1.id), tcase_id: String(E.tc.id) });
});
unit('tapd_delete_tcase_story_relation', async () => {
  await call('tapd_delete_tcase_story_relation', { workspace_id: WORKSPACE_ID, story_id: String(E.s1.id), tcase_id: String(E.tc.id) });
});

unit('tapd_save_time_relations', async () => {
  await assertZzz('story', E.s1.id, 'time_rel 前置');
  await assertZzz('story', E.s3.id, 'time_rel 后置');
  // relation_type 执行时按 schema 枚举校正
  await call('tapd_save_time_relations', {
    workspace_id: WORKSPACE_ID,
    relations: JSON.stringify([{ predecessor_id: String(E.s1.id), successor_id: String(E.s3.id), relation_type: 'ASSOC' }]),
  });
});
unit('tapd_delete_time_relations', async () => {
  await call('tapd_delete_time_relations', {
    workspace_id: WORKSPACE_ID,
    relations: JSON.stringify([{ predecessor_id: String(E.s1.id), successor_id: String(E.s3.id), relation_type: 'ASSOC' }]),
  });
});

unit('tapd_update_story_parent', async () => {
  await assertZzz('story', E.s1.id, 'story_parent 子');
  await assertZzz('story', E.s2.id, 'story_parent 父');
  await call('tapd_update_story_parent', { id: String(E.s3.id), parent_id: String(E.s2.id) });
  await call('tapd_update_story_parent', { id: String(E.s3.id), parent_id: '0' });
});

unit('tapd_update_bug', async () => {
  await call('tapd_update_bug', { id: String(E.b1.id), title: `${E.b1.title}-upd`, current_owner: USER });
  await assertZzz('bug', E.b1.id, 'update_bug');
});

unit('tapd_batch_update_bugs', async () => {
  await assertZzz('bug', E.b1.id, 'batch_bugs 每项');
  await assertZzz('bug', E.b2.id, 'batch_bugs 每项');
  await call('tapd_batch_update_bugs', {
    workspace_id: WORKSPACE_ID,
    bugs: JSON.stringify([{ id: String(E.b1.id), priority: '2' }, { id: String(E.b2.id), priority: '2' }]),
  });
});

unit('tapd_copy_bug', async () => {
  await assertZzz('bug', E.b2.id, 'copy_bug 源');
  E.b2copy = await createReg('tapd_copy_bug', 'bug', {
    id: String(E.b2.id), workspace_id: WORKSPACE_ID, title: nm('bug-b-copy'),
  }, 'title');
});

unit('tapd_link_bugs', async () => {
  await assertZzz('bug', E.b1.id, 'link_bugs 主');
  await assertZzz('bug', E.b2copy.id, 'link_bugs 从');
  await call('tapd_link_bugs', { bug_id: String(E.b1.id), link_bug_id: String(E.b2copy.id) });
});
unit('tapd_delete_link_bugs', async () => {
  await call('tapd_delete_link_bugs', { bug_id: String(E.b1.id), link_bug_id: String(E.b2copy.id) });
});

unit('tapd_update_task', async () => {
  await call('tapd_update_task', { id: String(E.t1.id), name: `${E.t1.name}-upd`, owner: USER });
  await assertZzz('task', E.t1.id, 'update_task');
});

unit('tapd_batch_update_tasks', async () => {
  await assertZzz('task', E.t1.id, 'batch_tasks 每项');
  await call('tapd_batch_update_tasks', { tasks: JSON.stringify([{ id: String(E.t1.id), priority: '2' }]) });
});
unit('tapd_update_comment', async () => {
  await call('tapd_update_comment', { id: String(E.comment.id), description: 'rc19 评论-upd' });
});

unit('tapd_update_timesheet', async () => {
  await call('tapd_update_timesheet', { id: String(E.ts.id), timespent: 2 });
});
unit('tapd_delete_timesheets', async () => {
  await call('tapd_delete_timesheets', { id: String(E.ts.id) }); // 自建工时删除闭环
});

unit('tapd_update_module', async () => {
  await call('tapd_update_module', { id: String(E.mod.id), name: `${E.mod.name}-upd` });
});

unit('tapd_update_version', async () => {
  await call('tapd_update_version', { id: String(E.ver.id), name: `${E.ver.name}-upd` });
});

unit('tapd_update_feature', async () => {
  await call('tapd_update_feature', { id: String(E.feat.id), name: `${E.feat.name}-upd` });
});

unit('tapd_update_baseline', async () => {
  await call('tapd_update_baseline', { id: String(E.bl.id), description: 'rc19-upd' });
});

// 自建字段 key 从 add 返回值取（TAPD 预分配槽位如 custom_field_one，不可拼接 ID）
function fieldKeyOf(cf) {
  const key = cf?.key ?? cf?.custom_field_key ?? cf?.field_key;
  if (!key) throw new Error('自建字段返回无 key，无法调用 select_field_options');
  return key;
}

unit('tapd_update_bug_select_field_options', async () => {
  if (!E.cfb?.id) throw new Error('SKIP: 前置 bug 下拉字段未创建');
  // C1：仅自建字段 + 强制 append_mode=1
  await call('tapd_update_bug_select_field_options', {
    workspace_id: WORKSPACE_ID,
    custom_field_key: fieldKeyOf(E.cfb),
    options: `${ZZZ_PREFIX}bopt3`,
    append_mode: 1,
  });
});
unit('tapd_update_story_select_field_options', async () => {
  if (!E.cf?.id) throw new Error('SKIP: 前置 story 下拉字段未创建');
  await call('tapd_update_story_select_field_options', {
    workspace_id: WORKSPACE_ID,
    custom_field_key: fieldKeyOf(E.cf),
    options: `${ZZZ_PREFIX}opt3`,
    append_mode: 1,
  });
});
unit('tapd_update_cascade_field_options', async () => {
  // custom_field_config 不可删除配额（≤2）已被 story/bug 下拉占满，级联字段无法自建 → 豁免记录
  throw new Error('SKIP: custom_field_config 不可删除配额已满（2/2），级联字段无自建来源（C1 约束豁免）');
});

unit('tapd_update_test_case', async () => {
  await call('tapd_update_test_case', { id: String(E.tc.id), name: `${E.tc.name}-upd`, owner: USER });
  await assertZzz('test_case', E.tc.id, 'update_test_case');
});

unit('tapd_assign_tcase_instance', async () => {
  await call('tapd_assign_tcase_instance', { workspace_id: WORKSPACE_ID, test_plan_id: String(E.tp.id), tcase_id: String(E.tc.id), owner: USER });
});
unit('tapd_execute_tcase_instance', async () => {
  await call('tapd_execute_tcase_instance', {
    workspace_id: WORKSPACE_ID, test_plan_id: String(E.tp.id), tcase_id: String(E.tc.id), result: 'pass',
  });
});
unit('tapd_remove_tcase_instance', async () => {
  await call('tapd_remove_tcase_instance', { workspace_id: WORKSPACE_ID, test_plan_id: String(E.tp.id), tcase_id: String(E.tc.id) });
});

unit('tapd_update_test_plan', async () => {
  await call('tapd_update_test_plan', { id: String(E.tp.id), name: `${E.tp.name}-upd` });
  await assertZzz('test_plan', E.tp.id, 'update_test_plan');
});

unit('tapd_create_story_relation', async () => {
  await assertZzz('test_plan', E.tp.id, 'story_relation plan 端');
  await assertZzz('story', E.s2.id, 'story_relation story 端');
  await call('tapd_create_story_relation', { test_plan_id: String(E.tp.id), story_id: String(E.s2.id) });
});
unit('tapd_delete_story_relation', async () => {
  await call('tapd_delete_story_relation', { test_plan_id: String(E.tp.id), story_id: String(E.s2.id) });
});
unit('tapd_create_tcase_relation', async () => {
  await call('tapd_create_tcase_relation', { test_plan_id: String(E.tp.id), tcase_id: String(E.tc.id) });
});

unit('tapd_update_wiki', async () => {
  await call('tapd_update_wiki', { id: String(E.wiki.id), title: `${E.wiki.title}-upd`, description: 'rc19 wiki 更新' });
  await assertZzz('wiki', E.wiki.id, 'update_wiki');
});

unit('tapd_update_release', async () => {
  await call('tapd_update_release', { id: String(E.rel.id), description: 'rc19-upd' });
});

unit('tapd_add_launch_accessories', async () => {
  if (!E.launch?.id) throw new Error('SKIP: 前置 launch_form 未创建（外部依赖）');
  await call('tapd_add_launch_accessories', {
    workspace_id: WORKSPACE_ID, launch_id: String(E.launch.id), type: 'text', content: 'rc19 评审依据',
  });
});

unit('tapd_add_story_link_relation', async () => {
  await assertZzz('story', E.s2.id, 'story_link 源');
  await assertZzz('story', E.s2copy.id, 'story_link 目标');
  await call('tapd_add_story_link_relation', {
    source_story_id: String(E.s2.id), target_story_id: String(E.s2copy.id), link_type: 'ASSOC',
  });
});
unit('tapd_remove_story_link_relation', async () => {
  await call('tapd_remove_story_link_relation', { source_story_id: String(E.s2.id), target_story_id: String(E.s2copy.id) });
});

unit('tapd_update_board_card', async () => {
  if (!E.bc?.id) throw new Error('SKIP: 前置 board_card 未创建（无看板外部依赖）');
  await call('tapd_update_board_card', { id: String(E.bc.id), name: `${E.bc.name}-upd`, owner: USER });
});

unit('tapd_add_code_commit_infos', async () => {
  const sha = `rc19${String(STAMP).padEnd(40, '0')}`.slice(0, 40);
  await call('tapd_add_code_commit_infos', {
    workspace_id: WORKSPACE_ID, commit_id: sha, message: `rc19 test commit ${STAMP}`, committer: USER,
    commit_time: '2026-09-04 12:00:00', entity_type: 'story', entity_id: String(E.s1.id),
    files: JSON.stringify([]),
  });
});

// ============================================================
// 执行循环
// ============================================================
await (async () => {
  for (const u of units) {
    if (completed.has(u.tool)) { results.SKIP.push(`${u.tool} (断点续跑：已完成)`); continue; }
    try {
      await u.fn();
      results.PASS.push(u.tool);
      completed.add(u.tool);
    } catch (e) {
      const msg = String(e.message ?? e);
      if (msg.startsWith('SKIP')) {
        results.SKIP.push(`${u.tool} ${msg.slice(5, 120)}`);
        completed.add(u.tool); // SKIP 视为已处理，续跑不重复
      } else {
        results.FAIL.push(`${u.tool}: ${msg.slice(0, 150)}`);
        r.note(`FAIL ${u.tool}: ${msg.slice(0, 120)}`);
        // 失败不记 completed，断点续跑可重试；除非请求预算超限
        if (/请求预算超限/.test(msg)) { saveProgress(); break; }
      }
    }
    saveProgress();
  }
})();

// ===== 汇总 =====
r.note(`请求预算: ${apiCalls}/${BUDGET}`);
r.note(`PASS ${results.PASS.length} / SKIP ${results.SKIP.length} / FAIL ${results.FAIL.length} / 总单元 ${units.length}`);
for (const s of results.SKIP) r.note(`SKIP: ${s}`);
r.check(`写全量无 FAIL（${results.FAIL.length}）`, results.FAIL.length === 0, results.FAIL.slice(0, 8).join(' | '));
r.check('请求预算 <800', apiCalls < BUDGET);
r.note(`孤儿台账: ${ORPHAN_LEDGER}（清理清单唯一底稿，不可清理类已标 irremovable）`);

mcp.stop();
const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
