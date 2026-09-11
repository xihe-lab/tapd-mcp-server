// S4（pm 进度+成本场景）模板测试：schedule-standup / schedule-burndown / cost-report
// 口径：内置模板发现 → S1 严格校验（含 domain 剥离后的 loadPmTemplate）→ mock registry
// 真实执行 → report 断言；registry 为 mock 不触真实 API，无凭证可跑。
// 运行: npx tsx packages/cli/src/pm/tpl-schedule-cost.test.ts

import assert from 'node:assert/strict';
import { z } from 'zod';
import type { ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry, allTools } from '@xihe-lab/tapd-core';
import type { TapdClient } from '@xihe-lab/tapd-core';
import { discoverPmTemplates, loadPmTemplate, resolvePmEntry } from './discovery.js';
import { assertTemplateValid } from '../pipeline/validate.js';
import { runPipeline } from '../pipeline/engine.js';

// ---- 工具 ----------------------------------------------------------------

const isoDay = (offsetDays: number): string =>
  new Date(new Date(todayStr() + 'T00:00:00Z').getTime() + offsetDays * 86400000).toISOString().slice(0, 10);

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 引擎 expr 沙箱同款"今天"，供 mock 数据动态对齐日期窗口 */
function engineToday(): string {
  return todayStr();
}

// ---- 场景 1/2 共享 fixture：迭代实体 + 变更记录 ----------------------------

const ITER_ID = '1139814312001000048';

const STORIES = [
  { id: '9001', name: 'story-A', owner: 'alice', status: 'done', begin: '2026-09-01', due: '2026-09-10', effort: '5', effort_completed: '4', remain: '0', completed: `${isoDay(-1)} 16:00:00` },
  { id: '9002', name: 'story-B', owner: 'bob', status: 'developing', begin: '2026-09-02', due: '2026-09-20', effort: '8', effort_completed: '2', remain: '6', completed: '' },
  { id: '9003', name: 'zzz-delete-me 脏数据', owner: 'carol', status: 'done', effort: '3', effort_completed: '3', remain: '0', completed: `${isoDay(-1)} 10:00:00` },
];

const TASKS = [
  // alice：昨日完成（status→done 变更）
  { id: '8001', name: 'task-A1', owner: 'alice', status: 'done', progress: '100', begin: '2026-09-01', due: '2026-09-10', effort: '3', effort_completed: '3', remain: '0', completed: `${isoDay(-1)} 18:00:00` },
  // bob：进行中、progress 0 且 begin 已过 → 阻塞
  { id: '8002', name: 'task-B1', owner: 'bob', status: 'developing', progress: '0', begin: isoDay(-3), due: isoDay(2), effort: '5', effort_completed: '0', remain: '5', completed: '' },
  // bob：进行中、progress 50 → 今日计划（非阻塞）
  { id: '8003', name: 'task-B2', owner: 'bob', status: 'developing', progress: '50%', begin: isoDay(-1), due: isoDay(3), effort: '4', effort_completed: '2', remain: '2', completed: '' },
  // carol：脏数据，应被 zzz 过滤剔除
  { id: '8004', name: 'zzz-delete-me task', owner: 'carol', status: 'developing', progress: '0', begin: isoDay(-5), due: isoDay(5), effort: '2', effort_completed: '0', remain: '2', completed: '' },
];

const BUGS = [
  { id: '7001', title: 'bug-open-alice', current_owner: 'alice', status: 'in_progress' },
  { id: '7002', title: 'bug-open-bob', current_owner: 'bob', status: 'new' },
  { id: '7003', title: 'bug-fixed-bob', current_owner: 'bob', status: 'resolved' },
];

const STORY_CHANGES = [
  { story_id: '9001', field: 'status', old_value: 'developing', new_value: 'done', created: `${isoDay(-1)} 16:00:00`, author: 'alice' },
  // 昨日之前的老变更 → 不进"昨日完成"
  { story_id: '9002', field: 'status', old_value: 'new', new_value: 'developing', created: `${isoDay(-9)} 09:00:00`, author: 'bob' },
  // 非状态字段 → 不算完成
  { story_id: '9002', field: 'owner', old_value: '', new_value: 'bob', created: `${isoDay(-1)} 10:00:00`, author: 'bob' },
];

const TASK_CHANGES = [
  { task_id: '8001', field: 'status', old_value: 'developing', new_value: 'done', created: `${isoDay(-1)} 18:00:00`, author: 'alice' },
  // 同一实体两次 done 变更 → 去重取首条
  { task_id: '8001', field: 'status', old_value: 'done', new_value: 'done', created: `${isoDay(-1)} 19:00:00`, author: 'alice' },
];

const mockEntityTools = (tracker: { calls: Record<string, unknown>[] }): ToolDef[] => [
  {
    name: 'tapd_get_iterations',
    description: 'mock',
    inputSchema: z.object({ id: z.string().optional(), fields: z.string().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_iterations', ...(p as Record<string, unknown>) });
      return Promise.resolve([{ id: ITER_ID, name: 'Sprint-S4', startdate: isoDay(-9), enddate: isoDay(5), status: 'open' }]);
    },
  },
  {
    name: 'tapd_get_stories',
    description: 'mock',
    inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_stories', ...(p as Record<string, unknown>) });
      return Promise.resolve(STORIES);
    },
  },
  {
    name: 'tapd_get_tasks',
    description: 'mock',
    inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_tasks', ...(p as Record<string, unknown>) });
      return Promise.resolve(TASKS);
    },
  },
  {
    name: 'tapd_get_bugs',
    description: 'mock',
    inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_bugs', ...(p as Record<string, unknown>) });
      return Promise.resolve(BUGS);
    },
  },
  {
    name: 'tapd_get_story_changes',
    description: 'mock',
    inputSchema: z.object({ story_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_story_changes', ...(p as Record<string, unknown>) });
      return Promise.resolve(STORY_CHANGES);
    },
  },
  {
    name: 'tapd_get_task_changes',
    description: 'mock',
    inputSchema: z.object({ task_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_task_changes', ...(p as Record<string, unknown>) });
      return Promise.resolve(TASK_CHANGES);
    },
  },
];

// ---- 场景 3 fixture：task 工时 + timesheets 填报 ---------------------------

const COST_TASKS = [
  { id: '6001', name: 'impl-x', owner: 'alice', status: 'done', effort: '5', effort_completed: '4', remain: '0', exceed: '0' },
  { id: '6002', name: 'impl-y', owner: 'bob', status: 'developing', effort: '8', effort_completed: '3', remain: '5', exceed: '1' },
  // 有预算但区间无填报 → 任务级缺失
  { id: '6003', name: 'impl-z-no-sheet', owner: 'carol', status: 'developing', effort: '6', effort_completed: '0', remain: '6', exceed: '0' },
  { id: '6004', name: 'zzz-delete-me task', owner: 'dave', status: 'developing', effort: '9', effort_completed: '0', remain: '9', exceed: '0' },
];

const TIMESHEETS = [
  { entity_type: 'task', entity_id: '6001', owner: 'alice', timespent: '4', spentdate: isoDay(-1) },
  { entity_type: 'task', entity_id: '6002', owner: 'bob', timespent: '2', spentdate: isoDay(-1) },
  // bob 重复填报 → AC 合计 3
  { entity_type: 'task', entity_id: '6002', owner: 'bob', timespent: '1', spentdate: isoDay(-2) },
];

const mockCostTools = (tracker: { calls: Record<string, unknown>[] }): ToolDef[] => [
  {
    name: 'tapd_get_iterations',
    description: 'mock',
    inputSchema: z.object({ id: z.string().optional(), fields: z.string().optional(), workspace_id: z.number().optional() }),
    handler: () => Promise.resolve([{ id: ITER_ID, name: 'Sprint-S4', startdate: isoDay(-9), enddate: isoDay(5), status: 'open' }]),
  },
  {
    name: 'tapd_get_tasks',
    description: 'mock',
    inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_tasks', ...(p as Record<string, unknown>) });
      return Promise.resolve(COST_TASKS);
    },
  },
  {
    name: 'tapd_get_timesheets',
    description: 'mock',
    inputSchema: z.object({ spentdate: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
    handler: (_c, p) => {
      tracker.calls.push({ tool: 'tapd_get_timesheets', ...(p as Record<string, unknown>) });
      return Promise.resolve(TIMESHEETS);
    },
  },
];

// ---- harness ---------------------------------------------------------------

function fullRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(allTools);
  return registry;
}

function mockRegistry(tools: ToolDef[]): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(tools);
  return registry;
}

async function execTemplate(
  domain: string,
  scenario: string,
  registry: ToolRegistry,
  vars: Record<string, unknown> = {},
  opts: { dryRun?: boolean } = {},
) {
  const entry = resolvePmEntry(discoverPmTemplates(), domain, scenario);
  const { template } = loadPmTemplate(entry);
  return runPipeline(
    template,
    {
      registry,
      // registry.exec 会先构建 client 再进 handler；mock handler 不触 HTTP，哑 client 即可
      clientFactory: () => ({}) as unknown as TapdClient,
      vars,
      defaultArgs: { workspace_id: 39814312 },
      dryRun: opts.dryRun === true,
      log: () => undefined,
    },
    () => undefined,
  );
}

// ---- checks ----------------------------------------------------------------

const checks: [string, () => void | Promise<void>][] = [
  ['发现：三个场景收录于 builtin（schedule::standup / schedule::burndown / cost::report，均只读）', () => {
    const { entries } = discoverPmTemplates();
    const expect: [string, string][] = [['schedule', 'standup'], ['schedule', 'burndown'], ['cost', 'report']];
    for (const [domain, scenario] of expect) {
      const hit = entries.find(e => e.domain === domain && e.scenario === scenario);
      assert.ok(hit, `pm list 缺 ${domain}::${scenario}`);
      assert.equal(hit.source, 'builtin');
      assert.equal(hit.write, false, `${domain}::${scenario} 必须只读`);
      assert.ok(hit.title.length > 0);
    }
  }],

  ['静态校验：domain 剥离后过 S1 严格校验，且无写步骤（对全量 core 工具 registry）', () => {
    const registry = fullRegistry();
    for (const [domain, scenario] of [['schedule', 'standup'], ['schedule', 'burndown'], ['cost', 'report']] as const) {
      const entry = resolvePmEntry(discoverPmTemplates(), domain, scenario);
      const { template } = loadPmTemplate(entry);
      const result = assertTemplateValid(template, registry);
      assert.deepEqual(result.writeSteps, [], '三个场景均为只读');
      for (const step of template.steps) {
        assert.ok(step.uses ?? step.expr, `${step.id} 必须是 uses/expr 之一`);
      }
    }
  }],

  ['standup：多 ID 合并查询（实体 id 列表 join 逗号，脏数据 id 不入参）+ 昨日完成/阻塞/未解 bug 分组', async () => {
    const tracker: { calls: Record<string, unknown>[] } = { calls: [] };
    const summary = await execTemplate('schedule', 'standup', mockRegistry(mockEntityTools(tracker)), { iteration_id: ITER_ID });
    assert.equal(summary.ok, true, `pipeline 应 ok: ${JSON.stringify(summary.steps.filter(s => s.status === 'failed'))}`);

    const storyChange = tracker.calls.find(c => c.tool === 'tapd_get_story_changes');
    assert.ok(storyChange, '应发生 story_changes 调用');
    assert.equal(storyChange.story_id, '9001,9002', 'story id 列表应 join 成多 ID 参数且剔除 zzz');
    const taskChange = tracker.calls.find(c => c.tool === 'tapd_get_task_changes');
    assert.ok(taskChange, '应发生 task_changes 调用');
    assert.equal(taskChange.task_id, '8001,8002,8003', 'task id 列表应 join 成多 ID 参数且剔除 zzz');

    const report = summary.report ?? '';
    // 昨日完成：story-A(alice) + task-A1(alice)，task-A1 重复变更去重
    assert.ok(report.includes('## 一、昨日完成（2）'), `昨日完成应为 2 条:\n${report}`);
    assert.ok(report.includes('| alice | story | 9001 | story-A |'), report);
    assert.ok(report.includes('| alice | task | 8001 | task-A1 |'), report);
    // 今日计划：bob 两条（剔除 zzz task）
    assert.ok(report.includes('## 二、今日计划（2）'), report);
    // 阻塞：task-B1（progress=0 且 begin<今天），task-B2 progress 50% 不阻塞
    assert.ok(report.includes('## 三、阻塞扫描（1）'), report);
    assert.ok(report.includes('| bob | 8002 | task-B1 |'), report);
    const blockSection = report.split('## 三、阻塞扫描')[1]?.split('## 未解 bug')[0] ?? '';
    assert.ok(!blockSection.includes('8003'), 'progress=50% 的任务不应进阻塞');
    // 未解 bug：alice 1（in_progress）、bob 1（resolved 不计）
    assert.ok(report.includes('| alice | 1 |') && report.includes('| bob | 1 |'), report);
    // 按人汇总表存在
    assert.ok(report.includes('## 按人汇总'), report);
    assert.ok(report.includes('口径：'), '报告必须带口径脚注');
  }],

  ['standup：变更记录 created<昨日 不计入昨日完成（日期窗口用 expr 计算）', async () => {
    const tracker: { calls: Record<string, unknown>[] } = { calls: [] };
    const summary = await execTemplate('schedule', 'standup', mockRegistry(mockEntityTools(tracker)), { iteration_id: ITER_ID });
    const report = summary.report ?? '';
    assert.ok(!report.includes('| bob | story | 9002'), '9 天前的状态变更不应进昨日完成');
    const today = engineToday();
    assert.ok(report.includes(`昨日 ${isoDay(-1)} → 今日 ${today}`), `数据窗口应动态注入: ${report.split('\n')[2]}`);
  }],

  ['burndown：总量快照 + 按日趋势（完成日回放），趋势行数 = 迭代天数，口径脚注注明近似性', async () => {
    const summary = await execTemplate('schedule', 'burndown', mockRegistry(mockEntityTools({ calls: [] })), { iteration_id: ITER_ID });
    assert.equal(summary.ok, true, JSON.stringify(summary.steps.filter(s => s.status === 'failed')));

    const burndown = summary.steps.find(s => s.id === 'burndown');
    assert.ok(burndown?.status === 'ok');
    const data = burndown.data as {
      totals: { totalStories: number; totalTasks: number; doneStories: number; totalEffort: number };
      trend: { date: string; doneEntities: number; remainEntities: number; burnEffort: number; remainEffort: number }[];
      dist: { date: string; completed: number }[];
      meta: { days: number };
    };
    // zzz 脏数据剔除后：2 stories（1 done）+ 3 tasks（1 done），总预估 5+8+3+4+5 = 25
    assert.equal(data.totals.totalStories, 2);
    assert.equal(data.totals.totalTasks, 3);
    assert.equal(data.totals.doneStories, 1);
    assert.equal(data.totals.totalEffort, 25);
    // 窗口 = startdate(-9) ~ today = 10 天
    assert.equal(data.meta.days, 10);
    assert.equal(data.trend.length, 10);
    assert.equal(data.dist.length, 10);
    // 完成日回放：story-9001 与 task-8001 完成于昨日 → 完成日 done=2、剩余 3、burn=8（5+3）
    const last = data.trend[data.trend.length - 1];
    const doneDayRow = data.trend[data.trend.length - 2];
    const beforeDoneDay = data.trend[data.trend.length - 3];
    assert.equal(last.doneEntities, 2, '今天累计完成仍为 2');
    assert.equal(doneDayRow.doneEntities, 2, '昨日（完成日）累计完成 2');
    assert.equal(doneDayRow.remainEntities, 3);
    assert.equal(doneDayRow.burnEffort, 8);
    assert.equal(doneDayRow.remainEffort, 17);
    assert.equal(beforeDoneDay.doneEntities, 0, '完成日前一天累计完成为 0');
    assert.ok(data.dist[8].completed === 2 && data.dist[9].completed === 0, '按日分布应集中在昨日');

    const report = summary.report ?? '';
    assert.ok(report.includes('## 按日趋势（完成日回放）'), report);
    assert.ok(report.includes('口径：剩余量按「完成日回放」近似'), '必须注明口径');
  }],

  ['cost-report：预算/已耗/剩余/超支聚合 + owner 分解（比率保留分母）+ 双级缺失名单', async () => {
    const tracker: { calls: Record<string, unknown>[] } = { calls: [] };
    const summary = await execTemplate('cost', 'report', mockRegistry(mockCostTools(tracker)), { iteration_id: ITER_ID });
    assert.equal(summary.ok, true, JSON.stringify(summary.steps.filter(s => s.status === 'failed')));

    const sheet = tracker.calls.find(c => c.tool === 'tapd_get_timesheets');
    assert.ok(sheet, '应发生 timesheets 调用');
    assert.equal(sheet.spentdate, `${isoDay(-9)}~${isoDay(5)}`, 'spentdate 应传迭代区间的 TAPD 时间区间');

    const cost = summary.steps.find(s => s.id === 'cost');
    assert.ok(cost?.status === 'ok');
    const data = cost.data as {
      totals: { budget: number; used: number; remain: number; exceed: number; ac: number; cv: number; missingOwnerCount: number; missingTaskCount: number };
      ownerRows: { owner: string; effort: number; timespent: number; rate: string }[];
    };
    // zzz 剔除后：预算 5+8+6=19，已耗 4+3=7，剩余 0+5+6=11，超支 1
    assert.equal(data.totals.budget, 19);
    assert.equal(data.totals.used, 7);
    assert.equal(data.totals.remain, 11);
    assert.equal(data.totals.exceed, 1);
    // AC = 4 + 2 + 1 = 7；CV = EV - AC = 0
    assert.equal(data.totals.ac, 7);
    assert.equal(data.totals.cv, 0);
    // 缺失：carol 有预算零填报；任务 6003 无填报记录（6004 已剔除）
    assert.equal(data.totals.missingOwnerCount, 1);
    assert.equal(data.totals.missingTaskCount, 1);
    // 比率保留分母
    const alice = data.ownerRows.find(r => r.owner === 'alice');
    assert.ok(alice?.rate === '4/5', `alice 完成率应保留分母: ${alice?.rate}`);

    const report = summary.report ?? '';
    assert.ok(report.includes('## 总量（EVM 类比）'), report);
    assert.ok(report.includes('| 已耗 EV = Σeffort_completed | 7 |'), report);
    assert.ok(report.includes('## 填报缺失名单（owner 级：有预算任务但区间零填报，共 1 人）'), report);
    assert.ok(report.includes('| carol | 6 | 1 |'), report);
    assert.ok(report.includes('共 1 个，至多列 20'), report);
    assert.ok(report.includes('| 6003 | impl-z-no-sheet | carol | 6 |'), report);
    assert.ok(report.includes('口径：'), '报告必须带口径脚注');
  }],

  ['cost-report：--input 覆盖填报窗口（vars.date_from/date_to 优先于迭代起止）', async () => {
    const tracker: { calls: Record<string, unknown>[] } = { calls: [] };
    await execTemplate('cost', 'report', mockRegistry(mockCostTools(tracker)), {
      iteration_id: ITER_ID,
      date_from: '2026-09-01',
      date_to: '2026-09-11',
    });
    const sheet = tracker.calls.find(c => c.tool === 'tapd_get_timesheets');
    assert.equal(sheet?.spentdate, '2026-09-01~2026-09-11', 'vars 覆盖应优先');
  }],

  ['standup：空迭代优雅降级（ids 以 0 占位，changes 空数组，报告归零不崩）', async () => {
    const empty = {
      name: 'tapd_get_stories',
      description: 'mock',
      inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
      handler: () => Promise.resolve([]),
    };
    const emptyTask = {
      name: 'tapd_get_tasks',
      description: 'mock',
      inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
      handler: () => Promise.resolve([]),
    };
    const emptyBug = {
      name: 'tapd_get_bugs',
      description: 'mock',
      inputSchema: z.object({ iteration_id: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
      handler: () => Promise.resolve([]),
    };
    const emptyChanges = (name: string, key: string): ToolDef => ({
      name,
      description: 'mock',
      inputSchema: z.object({ [key]: z.string().optional(), fields: z.string().optional(), limit: z.number().optional(), workspace_id: z.number().optional() }),
      handler: () => Promise.resolve([]),
    });
    const registry = mockRegistry([
      ...mockEntityTools({ calls: [] }).filter(t => !['tapd_get_stories', 'tapd_get_tasks', 'tapd_get_bugs', 'tapd_get_story_changes', 'tapd_get_task_changes'].includes(t.name)),
      empty,
      emptyTask,
      emptyBug,
      emptyChanges('tapd_get_story_changes', 'story_id'),
      emptyChanges('tapd_get_task_changes', 'task_id'),
    ]);
    const summary = await execTemplate('schedule', 'standup', registry, { iteration_id: ITER_ID });
    assert.equal(summary.ok, true, JSON.stringify(summary.steps.filter(s => s.status === 'failed')));
    const report = summary.report ?? '';
    assert.ok(report.includes('## 一、昨日完成（0）'), report);
    assert.ok(report.includes('需求 0 / 任务 0 / 缺陷 0'), report);
  }],

  ['三连 dry-run：全步骤只读预览、不触 HTTP、gateBlocked=false', async () => {
    for (const [domain, scenario] of [['schedule', 'standup'], ['schedule', 'burndown'], ['cost', 'report']] as const) {
      const summary = await execTemplate(domain, scenario, fullRegistry(), { iteration_id: ITER_ID }, { dryRun: true });
      assert.equal(summary.dryRun, true);
      assert.equal(summary.gateBlocked, false, '只读场景不应触发写闸门');
      assert.ok((summary.preview ?? []).length > 0);
      assert.ok(summary.steps.every(s => s.status === 'skipped'));
      assert.ok((summary.report ?? '').includes('dry-run: 仅打印执行计划'));
    }
  }],
];

// ---- runner（与 S2 测试同构：逐条跑、汇总退出码） ----------------------------

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(error);
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
