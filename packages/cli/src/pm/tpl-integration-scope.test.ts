// S3 域场景模板自检（TAPD 需求 1139814312001001543）：integration/scope 五场景
// —— 可被 pm 层发现与加载、过 S1 静态校验、write 标记正确、内置数据口径（zzz 过滤 /
//    风险项剔除 / 基线日期本地过滤）齐全，并以 mock registry 跑通五个场景的运行语义
// （写闸门 / ${steps...} 跨步骤链 / where 门控 / 报告渲染），全程不触真实 API。
//
// 运行: tsx packages/cli/src/pm/tpl-integration-scope.test.ts（不挂 package.json test 脚本，
// 接线由集成者统一处理）

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { TapdClient, ToolDef } from '@xihe-lab/tapd-core';
import { allTools, ToolRegistry } from '@xihe-lab/tapd-core';
import type { RunSummary } from '../pipeline/types.js';
import { runPipeline } from '../pipeline/engine.js';
import { validateTemplate } from '../pipeline/validate.js';
import { discoverPmTemplates, loadPmTemplate, resolvePmEntry } from './discovery.js';

// ---- 被检模板清单（与 templates/pm/ 下 S3 所有权文件一一对应）----

interface CaseSpec {
  file: string;
  domain: string;
  scenario: string;
  writeSteps: string[];
  varKeys: string[];
}

const CASES: CaseSpec[] = [
  { file: 'integration-health.yaml', domain: 'integration', scenario: 'health', writeSteps: [], varKeys: ['iteration_id'] },
  {
    file: 'integration-kickoff.yaml',
    domain: 'integration',
    scenario: 'kickoff',
    writeSteps: ['charter', 'new_iteration', 'release'],
    varKeys: ['project_name', 'startdate', 'enddate', 'wiki_content'],
  },
  { file: 'integration-close.yaml', domain: 'integration', scenario: 'close', writeSteps: ['close'], varKeys: ['iteration_id'] },
  { file: 'scope-baseline.yaml', domain: 'scope', scenario: 'baseline', writeSteps: ['freeze'], varKeys: ['iteration_id', 'iteration_name'] },
  { file: 'scope-drift-check.yaml', domain: 'scope', scenario: 'drift-check', writeSteps: [], varKeys: ['iteration_id', 'baseline_date'] },
];

// 列表型工具步骤必须内置 zzz-delete-me 过滤（口径硬约束）
const LIST_TOOLS = new Set(['tapd_get_iterations', 'tapd_get_stories', 'tapd_get_tasks', 'tapd_get_bugs', 'tapd_get_removed_stories']);

// ---- 环境隔离：用户模板目录指到空临时目录；关闭富文本自动改写（断言原始写参数）----

const userDir = mkdtempSync(path.join(tmpdir(), 'tapd-pm-tpl-s3-'));
const prevUserDir = process.env.TAPD_USER_TEMPLATES_DIR;
const prevRichtext = process.env.TAPD_RICHTEXT_AUTO;
process.env.TAPD_USER_TEMPLATES_DIR = userDir;
process.env.TAPD_RICHTEXT_AUTO = '0';

// ---- 真实 registry（静态校验用：工具存在性 / zod schema / write-policy 全走 core 事实源）----

const realRegistry = new ToolRegistry();
realRegistry.register(allTools);

// ---- mock registry（运行语义用）----

interface MockTracker {
  storiesArgs: Record<string, unknown>[];
  wikiArgs: Record<string, unknown>[];
  iterationCreateArgs: Record<string, unknown>[];
  releaseArgs: Record<string, unknown>[];
  iterationUpdateArgs: Record<string, unknown>[];
  baselineArgs: Record<string, unknown>[];
  changesArgs: Record<string, unknown>[];
  removedArgs: Record<string, unknown>[];
}

interface World {
  iteration: Record<string, unknown>[];
  stories: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  bugs: Record<string, unknown>[];
  changes: Record<string, unknown>[];
  removed: Record<string, unknown>[];
}

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = dayOffset(0);

function makeMockRegistry(world: World): { registry: ToolRegistry; tracker: MockTracker } {
  const tracker: MockTracker = {
    storiesArgs: [],
    wikiArgs: [],
    iterationCreateArgs: [],
    releaseArgs: [],
    iterationUpdateArgs: [],
    baselineArgs: [],
    changesArgs: [],
    removedArgs: [],
  };
  const def = (name: string, write: boolean, handler: (params: Record<string, unknown>) => Promise<unknown>): ToolDef => ({
    name,
    description: `mock: ${name}`,
    ...(write ? { write: true } : {}),
    // 宽松 schema：模板参数合法性已由 check 3 对真实 registry 校验过，这里只管放行并记录
    inputSchema: z.object({}).passthrough(),
    handler: (_client, params) => handler(params as Record<string, unknown>),
  });
  const tools: ToolDef[] = [
    def('tapd_get_iterations', false, () => Promise.resolve(world.iteration)),
    def('tapd_get_stories', false, params => {
      tracker.storiesArgs.push(params);
      return Promise.resolve(world.stories);
    }),
    def('tapd_get_tasks', false, () => Promise.resolve(world.tasks)),
    def('tapd_get_bugs', false, () => Promise.resolve(world.bugs)),
    def('tapd_get_story_changes', false, params => {
      tracker.changesArgs.push(params);
      return Promise.resolve(world.changes);
    }),
    def('tapd_get_removed_stories', false, params => {
      tracker.removedArgs.push(params);
      return Promise.resolve(world.removed);
    }),
    def('tapd_create_wiki', true, params => {
      tracker.wikiArgs.push(params);
      return Promise.resolve({ Wiki: { id: '8001', name: params.name } });
    }),
    def('tapd_create_iteration', true, params => {
      tracker.iterationCreateArgs.push(params);
      return Promise.resolve({ Iteration: { id: '9002', name: params.name } });
    }),
    def('tapd_create_release', true, params => {
      tracker.releaseArgs.push(params);
      return Promise.resolve({ Release: { id: '7001', name: params.name } });
    }),
    def('tapd_update_iteration', true, params => {
      tracker.iterationUpdateArgs.push(params);
      return Promise.resolve({ Iteration: { id: params.id, status: params.status } });
    }),
    def('tapd_add_baseline', true, params => {
      tracker.baselineArgs.push(params);
      return Promise.resolve({ Baseline: { id: '6001', name: params.name } });
    }),
  ];
  const registry = new ToolRegistry();
  registry.register(tools);
  return { registry, tracker };
}

const dummyClientFactory = () => ({}) as TapdClient;

async function runTpl(
  spec: CaseSpec,
  registry: ToolRegistry,
  opts: { vars?: Record<string, unknown>; yes?: boolean },
): Promise<RunSummary> {
  const catalog = discoverPmTemplates();
  const entry = resolvePmEntry(catalog, spec.domain, spec.scenario);
  const { template } = loadPmTemplate(entry);
  return runPipeline(template, {
    registry,
    clientFactory: dummyClientFactory,
    vars: opts.vars ?? {},
    defaultArgs: {},
    yes: opts.yes === true,
    log: () => undefined,
  });
}

// ---- 检查项 ----

const checks: [string, () => void | Promise<void>][] = [
  ['发现：五个场景模板收录于内置目录，域/场景/写标记正确，别名可解析', async () => {
    const catalog = discoverPmTemplates();
    for (const spec of CASES) {
      const entry = catalog.entries.find(e => e.file.endsWith(`templates/pm/${spec.file}`));
      assert.ok(entry, `未发现模板 ${spec.file}`);
      assert.equal(entry!.source, 'builtin');
      assert.equal(entry!.domain, spec.domain, `${spec.file} 域键`);
      assert.equal(entry!.scenario, spec.scenario, `${spec.file} 场景名`);
      assert.equal(entry!.name, spec.file.replace(/\.yaml$/, ''), 'name 约定 = 文件名 stem');
      assert.equal(entry!.write, spec.writeSteps.length > 0, `${spec.file} write 标记`);
      // 别名路由指向同一文件（tapd pm <domain> <scenario>）
      assert.equal(resolvePmEntry(catalog, spec.domain, spec.scenario).file, entry!.file);
    }
  }],

  ['加载：剥离 domain 字段后过 S1 严格 schema，模板结构与 vars 齐备', async () => {
    for (const spec of CASES) {
      const catalog = discoverPmTemplates();
      const entry = resolvePmEntry(catalog, spec.domain, spec.scenario);
      const { template, path } = loadPmTemplate(entry);
      assert.ok(path.endsWith(spec.file));
      assert.equal(template.name, spec.file.replace(/\.yaml$/, ''));
      assert.ok(template.steps.length >= 2, `${spec.file} 步骤数`);
      assert.ok(template.title && template.title.length > 4, 'title 为中文名+一句话');
      for (const key of spec.varKeys) {
        assert.ok(key in (template.vars ?? {}), `${spec.file} vars 缺 ${key}`);
      }
      // loadPmTemplate 已剥离 domain（S1 parseTemplate strict schema 不认识该字段，能 parse 即证明剥离成功）
      assert.ok(!('domain' in template));
    }
  }],

  ['静态校验：真实 toolRegistry 上 validateTemplate 全绿，写步骤清单与 write 标记一致', async () => {
    for (const spec of CASES) {
      const catalog = discoverPmTemplates();
      const { template } = loadPmTemplate(resolvePmEntry(catalog, spec.domain, spec.scenario));
      const result = validateTemplate(template, realRegistry);
      assert.deepEqual(
        result.errors,
        [],
        `${spec.file} 校验错误: ${result.errors.map(e => `${e.target}: ${e.message}`).join('; ')}`,
      );
      assert.equal(result.ok, true);
      assert.deepEqual(result.writeSteps.sort(), [...spec.writeSteps].sort(), `${spec.file} 写步骤清单`);
      assert.equal(template.write, spec.writeSteps.length > 0, `${spec.file} write 声明`);
    }
  }],

  ['数据口径：列表步骤内置 zzz 过滤；范围模板剔除风险项；drift 对基线日期本地过滤', async () => {
    for (const spec of CASES) {
      const catalog = discoverPmTemplates();
      const { template } = loadPmTemplate(resolvePmEntry(catalog, spec.domain, spec.scenario));
      for (const step of template.steps) {
        if (step.uses && LIST_TOOLS.has(step.uses)) {
          assert.ok(step.filter, `${spec.file}/${step.id}（${step.uses}）缺 zzz 过滤`);
          assert.ok(step.filter!.includes('zzz-delete-me'), `${spec.file}/${step.id} 过滤不含 zzz-delete-me`);
        }
      }
      const exprBlob = template.steps.map(s => s.expr ?? '').join('\n');
      if (spec.domain === 'scope' || spec.scenario === 'health') {
        assert.ok(exprBlob.includes("'risk'"), `${spec.file} expr 未按 label 剔除风险项`);
        assert.ok(exprBlob.includes('【风险】'), `${spec.file} expr 未按名称前缀剔除风险项`);
      }
    }
    const drift = await loadByScenario('scope', 'drift-check');
    const changesStep = drift.steps.find(s => s.id === 'changes')!;
    assert.ok(changesStep.filter!.includes('vars.baseline_date'), 'changes 步骤按 baseline_date 本地过滤');
    assert.ok(!changesStep.args || !('created' in changesStep.args), 'story_changes schema 无 created 参数，不得声明（会被丢弃并被校验报错）');
    const removedStep = drift.steps.find(s => s.id === 'removed')!;
    assert.ok(removedStep.filter!.includes('vars.baseline_date'), 'removed 步骤按 baseline_date 本地过滤');
  }],

  ['integration-health：只读执行聚合——时间%50 vs 完成度 3/5（60%）、逾期/未解红旗、风险项与 zzz 不入表', async () => {
    const world: World = {
      iteration: [{ id: '5001', name: 'Sprint H', startdate: dayOffset(-10), enddate: dayOffset(10), status: 'open' }],
      stories: [
        { id: 's1', name: '登录', owner: 'alice', status: 'closed', completed: TODAY },
        { id: 's2', name: '下单', owner: 'bob', status: 'resolved' },
        { id: 's3', name: '支付', owner: 'carol', status: 'done' },
        { id: 's4', name: '对账', owner: 'dave', status: 'progressing' },
        { id: 's5', name: '报表', owner: 'erin', status: 'open' },
        { id: 's6', name: '【风险】供应商接口', owner: 'frank', status: 'open', label: 'risk' },
        { id: 's7', name: 'zzz-delete-me 脏数据', owner: 'x', status: 'open' },
      ],
      tasks: [
        { id: 't1', name: '联调环境打通', owner: 'bob', status: 'progressing', due: dayOffset(-1) },
        { id: 't2', name: '提测单', owner: 'carol', status: 'done', due: dayOffset(-2) },
      ],
      bugs: [
        { id: 'b1', title: '支付超时崩溃', severity: '1', current_owner: 'bob', status: 'new' },
        { id: 'b2', title: 'zzz-delete-me 脏缺陷', severity: '3', current_owner: 'x', status: 'new' },
      ],
      changes: [],
      removed: [],
    };
    const { registry } = makeMockRegistry(world);
    const summary = await runTpl(CASES[0], registry, { vars: { iteration_id: '5001' } });
    assert.equal(summary.gateBlocked, false);
    assert.equal(summary.ok, true);
    assert.ok(summary.steps.every(s => s.status === 'ok' && s.write === false), '只读场景所有步骤 ok 且非写');
    const report = summary.report ?? '';
    assert.ok(report.includes('时间消耗: 50%'), report);
    assert.ok(report.includes('完成度: 3/5（60%）'), report);
    assert.ok(report.includes('剔除风险项 1 个'), report);
    assert.ok(report.includes('红（2 项红旗）'), report);
    assert.ok(report.includes('逾期任务') && report.includes('未解缺陷'), report);
    assert.ok(!report.includes('zzz-delete-me'), 'zzz 脏数据必须被过滤');
    assert.ok(!report.includes('【风险】供应商接口'), '风险项不进完成度口径明细');
  }],

  ['integration-kickoff：无 --yes 被写闸门拦截（0 次写调用）；--yes 后 wiki→iteration→release 串行，迭代 ID 经 ${steps...} 传入 release', async () => {
    const vars = { project_name: '星舰', startdate: dayOffset(0), enddate: dayOffset(30), wiki_content: '# 星舰章程\n北极星指标……' };
    const blockedWorld: World = { iteration: [], stories: [], tasks: [], bugs: [], changes: [], removed: [] };
    const blocked = makeMockRegistry(blockedWorld);
    const blockedSummary = await runTpl(CASES[1], blocked.registry, { vars, yes: false });
    assert.equal(blockedSummary.gateBlocked, true, '含写模板未 --yes 必须被闸门拦截');
    assert.equal(blockedSummary.dryRun, true);
    assert.equal(blockedSummary.preview?.length, 6, '预览含 5 步骤之外的全部 6 个步骤');
    assert.equal(blocked.tracker.wikiArgs.length + blocked.tracker.iterationCreateArgs.length + blocked.tracker.releaseArgs.length, 0, '闸门拦截时零写调用');

    const { registry, tracker } = makeMockRegistry(blockedWorld);
    const summary = await runTpl(CASES[1], registry, { vars, yes: true });
    assert.equal(summary.ok, true);
    assert.equal(tracker.wikiArgs.length, 1, '章程 wiki 落库一次');
    assert.equal(tracker.wikiArgs[0].name, '星舰 项目章程');
    assert.equal(tracker.wikiArgs[0].markdown_description, vars.wiki_content);
    assert.equal(tracker.iterationCreateArgs.length, 1, '首迭代落库一次');
    assert.equal(tracker.iterationCreateArgs[0].name, '星舰 首迭代');
    assert.equal(tracker.iterationCreateArgs[0].status, 'open');
    assert.ok(String(tracker.iterationCreateArgs[0].description).includes('wiki#8001'), '迭代描述引用前步章程 ID');
    assert.equal(tracker.releaseArgs.length, 1, '发布计划落库一次');
    assert.ok(String(tracker.releaseArgs[0].description).includes('（id=9002）'), 'release 依赖前步迭代 ID（${steps...} 链）');
    assert.equal(tracker.releaseArgs[0].end_date, vars.enddate);
    assert.ok((summary.report ?? '').includes('星舰 首迭代（id=9002）'), summary.report);
  }],

  ['integration-close：扫描出未完成项时 --yes 也不落库（where 门控）；清零后才关闭 status=done', async () => {
    const baseWorld = (openStory: boolean): World => ({
      iteration: [{ id: '5001', name: 'Sprint H', startdate: dayOffset(-20), enddate: dayOffset(-1), status: 'open' }],
      stories: [
        { id: 's1', name: '登录', owner: 'alice', status: 'closed' },
        ...(openStory ? [{ id: 's9', name: '对账', owner: 'dave', status: 'progressing' }] : []),
        { id: 's8', name: 'zzz-delete-me 脏数据', owner: 'x', status: 'open' },
      ],
      tasks: [{ id: 't1', name: '收尾', owner: 'bob', status: 'done' }],
      bugs: [],
      changes: [],
      removed: [],
    });

    const blockedRun = makeMockRegistry(baseWorld(true));
    const gateSummary = await runTpl(CASES[2], blockedRun.registry, { vars: { iteration_id: '5001' }, yes: false });
    assert.equal(gateSummary.gateBlocked, true, '未 --yes 被写闸门拦截');
    assert.equal(blockedRun.tracker.iterationUpdateArgs.length, 0);

    const dirtyRun = makeMockRegistry(baseWorld(true));
    const dirty = await runTpl(CASES[2], dirtyRun.registry, { vars: { iteration_id: '5001' }, yes: true });
    assert.equal(dirtyRun.tracker.iterationUpdateArgs.length, 0, '仍有未完成项：--yes 也不得关闭');
    const closeOutcome = dirty.steps.find(s => s.id === 'close')!;
    assert.equal(closeOutcome.status, 'skipped');
    assert.equal(closeOutcome.skipReason, 'where', '写步骤被 where 门控跳过');
    assert.ok((dirty.report ?? '').includes('存在 1 个未完成项'), dirty.report);
    assert.ok((dirty.report ?? '').includes('对账'), '报告列出未完成需求');

    const cleanRun = makeMockRegistry(baseWorld(false));
    const clean = await runTpl(CASES[2], cleanRun.registry, { vars: { iteration_id: '5001' }, yes: true });
    assert.equal(cleanRun.tracker.iterationUpdateArgs.length, 1, '无未完成项才落库关闭');
    assert.deepEqual(cleanRun.tracker.iterationUpdateArgs[0], { id: '5001', status: 'done' });
    assert.equal(clean.ok, true);
    assert.ok((clean.report ?? '').includes('已执行，迭代 5001 现状态: done'), clean.report);
  }],

  ['scope-baseline：快照全量入基线（zzz 过滤、风险项保留），基线名/日期由 expr 生成，--yes 才落库', async () => {
    const world: World = {
      iteration: [{ id: '5001', name: 'Sprint B', startdate: dayOffset(-3), enddate: dayOffset(7), status: 'open' }],
      stories: [
        { id: 's1', name: '登录', status: 'in progress', priority: 'High', label: '' },
        { id: 's2', name: '下单', status: 'done', priority: 'High', label: '' },
        { id: 's3', name: '【风险】供应商接口', status: 'open', priority: 'Middle', label: 'risk' },
        { id: 's7', name: 'zzz-delete-me 脏数据', status: 'open', priority: 'Low', label: '' },
      ],
      tasks: [], bugs: [], changes: [], removed: [],
    };
    const gateRun = makeMockRegistry(world);
    const gate = await runTpl(CASES[3], gateRun.registry, { vars: { iteration_id: '5001' }, yes: false });
    assert.equal(gate.gateBlocked, true);
    assert.equal(gateRun.tracker.baselineArgs.length, 0, '未 --yes 不落库');

    const { registry, tracker } = makeMockRegistry(world);
    const summary = await runTpl(CASES[3], registry, { vars: { iteration_id: '5001' }, yes: true });
    assert.equal(summary.ok, true);
    assert.equal(tracker.baselineArgs.length, 1);
    assert.equal(tracker.baselineArgs[0].name, `Sprint B-基线-${TODAY}`, '基线名 = 迭代名-基线-今天（expr 计算）');
    assert.equal(tracker.baselineArgs[0].baseline_date, TODAY, '基线日期 = 今天');
    const description = String(tracker.baselineArgs[0].description);
    assert.ok(description.includes('"id":"s1"') && description.includes('"id":"s3"'), '快照 JSON 落入基线描述');
    assert.ok(!description.includes('zzz-delete-me'), 'zzz 不入基线快照');
    const report = summary.report ?? '';
    assert.ok(report.includes(`范围基线已冻结 — Sprint B-基线-${TODAY}`), report);
    assert.ok(report.includes('3 项需求（剔除风险项 1 后，范围口径 2 项）'), report);
  }],

  ['scope-drift-check：只读三路拉取消——新增/字段变更/移除三清单，基线前记录与 zzz 均被过滤', async () => {
    const bd = dayOffset(0);
    const world: World = {
      iteration: [{ id: '5001', name: 'Sprint B', startdate: dayOffset(-30), enddate: dayOffset(7), status: 'open' }],
      stories: [
        { id: 's1', name: 'A-基线前已存在', owner: 'alice', status: 'progressing', label: '', created: dayOffset(-5) },
        { id: 's2', name: 'B-基线后新增', owner: 'bob', status: 'open', label: '', created: bd },
        { id: 's3', name: '【风险】C', owner: 'carol', status: 'open', label: 'risk', created: bd },
        { id: 's4', name: 'D-基线前已存在', owner: 'dave', status: 'open', label: '', created: dayOffset(-30) },
        { id: 's9', name: 'zzz-delete-me 脏数据', owner: 'x', status: 'open', label: '', created: bd },
      ],
      tasks: [], bugs: [],
      changes: [
        { id: 'c1', story_id: 's2', field: 'owner', value_before: 'bob', value_after: 'carol', author: 'op', created: `${bd} 10:00:00` },
        { id: 'c2', story_id: 's1', field: 'status', value_before: 'open', value_after: 'progressing', author: 'op', created: `${dayOffset(-9)} 10:00:00` },
      ],
      removed: [
        { id: 's5', name: 'F-基线后删除', owner: 'erin', creator: 'op', deleted: `${bd} 08:00:00` },
        { id: 's6', name: 'zzz-delete-me 脏删除', owner: 'x', creator: 'op', deleted: bd },
      ],
    };
    const { registry, tracker } = makeMockRegistry(world);
    const summary = await runTpl(CASES[4], registry, { vars: { iteration_id: '5001', baseline_date: bd } });
    assert.equal(summary.gateBlocked, false, '只读场景无闸门');
    assert.equal(summary.ok, true);
    assert.equal(tracker.changesArgs[0].limit, 200, 'changes 拉 200 条');
    assert.equal(tracker.changesArgs[0].order, 'created desc');
    const drift = summary.steps.find(s => s.id === 'drift')!;
    const data = drift.data as Record<string, unknown>;
    assert.equal(data.addedScopeCount, 1, '基线后新增仅范围口径 1 项（风险项另列）');
    assert.equal(data.addedCount, 2, '新增分母含风险项');
    assert.equal(data.changeCount, 1, '基线前变更被过滤');
    assert.equal(data.changedStoryCount, 1);
    assert.equal(data.removedCount, 1, 'zzz 删除记录被过滤');
    assert.equal(data.driftTotal, 3);
    const report = summary.report ?? '';
    assert.ok(report.includes('基线后新增（范围口径 1/2）'), report);
    assert.ok(report.includes('涉及 1 个需求'), report);
    assert.ok(report.includes('移除（1 项）'), report);
    assert.ok(report.includes('B-基线后新增') && report.includes('F-基线后删除'), report);
    assert.ok(!report.includes('zzz-delete-me 脏'), 'zzz 脏数据不得出现在报告（口径脚注文案除外）');
    assert.ok(!report.includes('A-基线前已存在'), '基线前新增不得入清单');
  }],
];

async function loadByScenario(domain: string, scenario: string) {
  const catalog = discoverPmTemplates();
  return loadPmTemplate(resolvePmEntry(catalog, domain, scenario)).template;
}

// ---- 运行器 ----

let failed = 0;
try {
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
} finally {
  if (prevUserDir === undefined) delete process.env.TAPD_USER_TEMPLATES_DIR;
  else process.env.TAPD_USER_TEMPLATES_DIR = prevUserDir;
  if (prevRichtext === undefined) delete process.env.TAPD_RICHTEXT_AUTO;
  else process.env.TAPD_RICHTEXT_AUTO = prevRichtext;
  rmSync(userDir, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
