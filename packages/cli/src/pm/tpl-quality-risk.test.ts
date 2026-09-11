// S5 场景模板集成测试：quality-dashboard / quality-triage / risk-scan / risk-register
//
// 口径：直接加载内置 templates/pm/*.yaml（discoverPmTemplates + loadPmTemplate 剥 domain），
// 逐一过 validateTemplate 静态校验与 runPipeline 真实执行（mock registry，不触 API）；
// CLI 链路（pm list / 别名 --dry-run / 写闸门 exit 2）用 buildProgram 走 S2 同构路径。
// TAPD_RICHTEXT_AUTO='0'：关闭 core 富文本自动转换，断言模板注入的原始参数（ richtext
// 转换属 core 自身行为，已在 core 侧覆盖）。

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { TapdClient, ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry } from '@xihe-lab/tapd-core';
import { discoverPmTemplates, loadPmTemplate, resolvePmEntry } from './discovery.js';
import { validateTemplate } from '../pipeline/validate.js';
import { runPipeline } from '../pipeline/engine.js';
import type { PipelineTemplate, RunSummary } from '../pipeline/index.js';
import { buildProgram } from '../program.js';

// ---- fixtures（含 zzz 脏数据 / 风险项 / 各状态控制组） ----

const ITERATIONS = [
  { id: '5001', name: 'Sprint Q3', startdate: '2026-09-01', enddate: '2026-09-30', status: 'open' },
];

// dashboard：3 有效 + 1 zzz；未解 = b1（b2 resolved / b3 closed 不算）
const DASH_BUGS = [
  { id: 'b1', title: '登录失败', severity: '1', status: 'new', priority_label: 'High', current_owner: 'alice', te: 'tester-a', de: 'dev-a', deadline: '2026-01-01' },
  { id: 'b2', title: '列表错位', severity: '2', status: 'resolved', priority_label: 'Middle', current_owner: 'bob', te: 'tester-a', de: 'dev-b', deadline: '' },
  { id: 'b3', title: '文案错字', severity: '3', status: 'closed', priority_label: 'Low', current_owner: 'bob', te: 'tester-b', de: 'dev-b', deadline: '' },
  { id: 'b4', title: 'zzz-delete-me 脏缺陷', severity: '4', status: 'new', priority_label: 'Low', current_owner: '', te: '', de: '', deadline: '' },
];

// dashboard：分母 = 2（s3 为【风险】项、s4 为 zzz 脏数据，均剔除）
const DASH_STORIES = [
  { id: 's1', name: '需求甲', status: 'new', owner: 'dev-a' },
  { id: 's2', name: '需求乙', status: 'done', owner: 'dev-b' },
  { id: 's3', name: '【风险】压测演练', status: 'new', owner: 'dev-a' },
  { id: 's4', name: 'zzz-delete-me 脏需求', status: 'new', owner: '' },
];

// triage：未解 4 = 高严重度 1（t1）+ 其余 3；t5 已解、t6 为 zzz
const TRIAGE_BUGS = [
  { id: 't1', title: '资损缺陷', severity: '1', status: 'new', priority_label: 'Urgent', current_owner: 'alice', te: 'tester-a', de: 'dev-a' },
  { id: 't2', title: '导出超时', severity: '3', status: 'new', priority_label: 'Middle', current_owner: 'bob', te: 'tester-b', de: 'dev-b' },
  { id: 't3', title: '按钮遮挡', severity: '4', status: 'new', priority_label: 'Low', current_owner: 'alice', te: 'tester-a', de: 'dev-a' },
  { id: 't4', title: '日志缺失', severity: '5', status: 'new', priority_label: 'Low', current_owner: '', te: '', de: '' },
  { id: 't5', title: '已解缺陷', severity: '1', status: 'resolved', priority_label: 'High', current_owner: 'alice', te: 'tester-a', de: 'dev-a' },
  { id: 't6', title: 'zzz-delete-me 脏缺陷', severity: '1', status: 'new', priority_label: 'Low', current_owner: '', te: '', de: '' },
];

// scan：任务 k1 逾期+超支50%、k2 正常、k3 done（不逾期）但超支10%、k4 zzz
const SCAN_TASKS = [
  { id: 'k1', name: '任务A', owner: 'alice', status: 'progressing', due: '2026-01-01', effort: '10', exceed: '5' },
  { id: 'k2', name: '任务B', owner: 'bob', status: 'progressing', due: '2999-01-01', effort: '10', exceed: '0' },
  { id: 'k3', name: '任务C', owner: 'bob', status: 'done', due: '2026-01-02', effort: '10', exceed: '1' },
  { id: 'k4', name: 'zzz-delete-me 脏任务', owner: '', status: 'progressing', due: '2026-01-01', effort: '1', exceed: '1' },
];

// scan：g1 逾期未解、g2 未到期、g3 逾期但已解（控制组）
const SCAN_BUGS = [
  { id: 'g1', title: '资损缺陷', severity: '1', status: 'new', current_owner: 'alice', deadline: '2026-01-01' },
  { id: 'g2', title: '普通缺陷', severity: '2', status: 'new', current_owner: 'bob', deadline: '2999-01-01' },
  { id: 'g3', title: '已解缺陷', severity: '3', status: 'closed', current_owner: 'bob', deadline: '2026-01-01' },
];

const SCAN_BLOCKED = [
  { id: 'i1', tcase_id: '9001', test_plan_id: 'tp-9', result: 'block', executed_by: 'qa1', executed: '2026-09-01' },
];

// scan：st1 被前置阻塞（st2 未完成、st3 已完成、r3 前置在迭代外）、st2 外部来源、st3 done 控制组、st4 zzz
const SCAN_STORIES = [
  { id: 'st1', name: '需求甲', status: 'new', owner: 'dev-a', source: '' },
  { id: 'st2', name: '需求乙', status: 'new', owner: 'dev-b', source: '客户A' },
  { id: 'st3', name: '需求丙', status: 'done', owner: 'dev-a', source: '' },
  { id: 'st4', name: 'zzz-delete-me 脏需求', status: 'new', owner: '', source: '' },
];

const SCAN_RELATIONS = [
  { predecessor_id: 'st3', successor_id: 'st1', relation_type: '1' },
  { predecessor_id: 'st2', successor_id: 'st1', relation_type: '1' },
  { predecessor_id: 'ext-999', successor_id: 'st1', relation_type: '2' },
];

const TEST_PLAN = { total: 10, passed: 6, pass_rate: '60%' };

interface Fixtures {
  iterations?: unknown;
  bugs?: unknown;
  stories?: unknown;
  tasks?: unknown;
  blocked?: unknown;
  relations?: unknown;
  testPlan?: unknown;
}

interface Trackers {
  bugs: Record<string, unknown>[];
  stories: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  blocked: Record<string, unknown>[];
  relations: Record<string, unknown>[];
  testPlans: Record<string, unknown>[];
  createStory: Record<string, unknown>[];
}

function makeRegistry(fixtures: Fixtures = {}): { registry: ToolRegistry; trackers: Trackers } {
  const fx = { iterations: ITERATIONS, bugs: DASH_BUGS, stories: DASH_STORIES, tasks: SCAN_TASKS, blocked: SCAN_BLOCKED, relations: SCAN_RELATIONS, testPlan: TEST_PLAN, ...fixtures };
  const trackers: Trackers = { bugs: [], stories: [], tasks: [], blocked: [], relations: [], testPlans: [], createStory: [] };
  const tools: ToolDef[] = [
    {
      name: 'tapd_get_iterations',
      description: 'mock: 迭代查询',
      inputSchema: z.object({ workspace_id: z.number().optional(), id: z.string().optional(), status: z.string().optional(), fields: z.string().optional() }),
      handler: () => Promise.resolve(fx.iterations),
    },
    {
      name: 'tapd_get_bugs',
      description: 'mock: 缺陷查询（记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), id: z.string().optional(), iteration_id: z.string().optional(), limit: z.number().optional(), fields: z.string().optional(), status: z.string().optional(), severity: z.string().optional(), deadline: z.string().optional(), label: z.string().optional() }),
      handler: (_c, p) => { trackers.bugs.push(p as Record<string, unknown>); return Promise.resolve(fx.bugs); },
    },
    {
      name: 'tapd_get_stories',
      description: 'mock: 需求查询（记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), iteration_id: z.string().optional(), limit: z.number().optional(), fields: z.string().optional(), status: z.string().optional() }),
      handler: (_c, p) => { trackers.stories.push(p as Record<string, unknown>); return Promise.resolve(fx.stories); },
    },
    {
      name: 'tapd_get_tasks',
      description: 'mock: 任务查询（记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), iteration_id: z.string().optional(), limit: z.number().optional(), fields: z.string().optional(), status: z.string().optional(), due: z.string().optional() }),
      handler: (_c, p) => { trackers.tasks.push(p as Record<string, unknown>); return Promise.resolve(fx.tasks); },
    },
    {
      name: 'tapd_get_tcase_result',
      description: 'mock: 用例执行结果（记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), tcase_id: z.string().optional(), test_plan_id: z.string().optional(), result: z.string().optional(), limit: z.number().optional(), fields: z.string().optional() }),
      handler: (_c, p) => { trackers.blocked.push(p as Record<string, unknown>); return Promise.resolve(fx.blocked); },
    },
    {
      name: 'tapd_get_time_relative_stories',
      description: 'mock: 需求前后置关系（记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), story_id: z.string().optional(), predecessor_id: z.string().optional(), successor_id: z.string().optional(), limit: z.number().optional(), fields: z.string().optional() }),
      handler: (_c, p) => { trackers.relations.push(p as Record<string, unknown>); return Promise.resolve(fx.relations); },
    },
    {
      name: 'tapd_get_test_plan_progress',
      description: 'mock: 测试计划进度（记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), test_plan_id: z.string() }),
      handler: (_c, p) => { trackers.testPlans.push(p as Record<string, unknown>); return Promise.resolve(fx.testPlan); },
    },
    {
      name: 'tapd_create_story',
      description: 'mock: 创建需求（写，记录入参）',
      inputSchema: z.object({ workspace_id: z.number().optional(), name: z.string(), description: z.string().optional(), iteration_id: z.string().optional(), label: z.string().optional(), priority_label: z.string().optional(), owner: z.string().optional() }),
      handler: (_c, p) => { trackers.createStory.push(p as Record<string, unknown>); return Promise.resolve({ id: 'new-1', name: (p as { name: string }).name }); },
    },
  ];
  const registry = new ToolRegistry();
  registry.register(tools);
  return { registry, trackers };
}

// ---- 加载内置 pm 模板（剥 domain 后交 S1 校验/执行） ----

interface Loaded {
  template: PipelineTemplate;
  steps: (id: string) => { status: string; write: boolean; skipReason?: string; data?: unknown };
  report: string;
  trackers: Trackers;
}

async function loadAndRun(domain: string, scenario: string, opts: { vars?: Record<string, unknown>; yes?: boolean; fixtures?: Fixtures } = {}): Promise<Loaded> {
  const { registry, trackers } = makeRegistry(opts.fixtures);
  const entry = resolvePmEntry(discoverPmTemplates(), domain, scenario);
  const { template } = loadPmTemplate(entry);
  const summary: RunSummary = await runPipeline(template, {
    registry,
    clientFactory: (() => ({})) as unknown as () => TapdClient,
    vars: { iteration_id: '5001', ...opts.vars },
    yes: opts.yes === true,
  });
  return {
    template,
    steps: id => {
      const s = summary.steps.find(x => x.id === id);
      assert.ok(s, `步骤 ${id} 存在于运行结果`);
      return s;
    },
    report: typeof summary.report === 'string' ? summary.report : '',
    trackers,
  };
}

// ---- env 隔离（用户模板目录清空 → 只测 builtin；关富文本自动转换） ----

const userDir = mkdtempSync(path.join(tmpdir(), 'tapd-pm-s5-'));
mkdirSync(path.join(userDir, 'pm'), { recursive: true });
const saved = {
  userDir: process.env.TAPD_USER_TEMPLATES_DIR,
  token: process.env.TAPD_ACCESS_TOKEN,
  richtext: process.env.TAPD_RICHTEXT_AUTO,
};
process.env.TAPD_USER_TEMPLATES_DIR = userDir;
process.env.TAPD_ACCESS_TOKEN = 'pm-s5-test-token';
process.env.TAPD_RICHTEXT_AUTO = '0';

const checks: [string, () => void | Promise<void>][] = [
  ['发现：四模板进 builtin 目录且域/场景/读写标记正确', () => {
    const entries = discoverPmTemplates().entries;
    const expect: [string, string, boolean][] = [
      ['quality', 'dashboard', false],
      ['quality', 'triage', false],
      ['risk', 'scan', false],
      ['risk', 'register', true],
    ];
    for (const [domain, scenario, write] of expect) {
      const hit = entries.find(e => e.domain === domain && e.scenario === scenario);
      assert.ok(hit, `pm ${domain} ${scenario} 被发现`);
      assert.equal(hit.source, 'builtin');
      assert.equal(hit.write, write, `pm ${domain} ${scenario} write 标记`);
      assert.equal(hit.name, `${domain}-${scenario}`, '模板名与文件名 stem 一致');
      assert.ok(hit.title.length > 0, 'title 非空（help/list 展示用）');
    }
  }],

  ['静态校验：四模板 0 error；writeSteps 仅 risk-register 含 register', () => {
    const { registry } = makeRegistry();
    const catalog = discoverPmTemplates();
    for (const [domain, scenario, write] of [['quality', 'dashboard', []], ['quality', 'triage', []], ['risk', 'scan', []], ['risk', 'register', ['register']]] as const) {
      const entry = resolvePmEntry(catalog, domain, scenario);
      const { template } = loadPmTemplate(entry);
      const result = validateTemplate(template, registry);
      assert.deepEqual(result.errors, [], `${domain}-${scenario} 校验 0 error`);
      assert.deepEqual(result.writeSteps, [...write], `${domain}-${scenario} 写步骤判定`);
    }
  }],

  ['quality-dashboard：密度保留分母、风险/脏数据剔除、矩阵与未解清单、缺 test_plan_id 注明跳过', async () => {
    const r = await loadAndRun('quality', 'dashboard');
    assert.ok(r.steps('bugs').status === 'ok' && r.steps('bugs').write === false);
    assert.equal(r.steps('test_plan').status, 'skipped', '未传 test_plan_id 时跳过');
    assert.equal(r.steps('test_plan').skipReason, 'where');
    // 密度：全量 3（b4 zzz 已滤）/ 需求 2（s3 风险、s4 zzz 已滤）
    assert.equal(r.steps('stats').data && (r.steps('stats').data as { densityText: string }).densityText, '3/2');
    const report = r.report;
    assert.ok(report.includes('缺陷密度（有效缺陷/需求，保留分母）: 3/2'), report);
    assert.ok(report.includes('severity × status 分布'), report);
    assert.ok(report.includes('| 严重度 | closed | new | resolved | 合计 |'), `矩阵表头按状态分列:\n${report}`);
    assert.ok(report.includes('| 1 | 0 | 1 | 0 | 1 |'), 'severity=1 行计数');
    assert.ok(report.includes('b1') && !report.includes('b4'), '未解清单含 b1、不含 zzz 缺陷 b4');
    assert.ok(!report.includes('【风险】压测演练'), '需求分母剔除【风险】项');
    assert.ok(report.includes('已跳过测试计划执行进度'), report);
  }],

  ['quality-dashboard：--input test_plan_id 注入后执行进度查询', async () => {
    const r = await loadAndRun('quality', 'dashboard', { vars: { test_plan_id: 'tp-9' } });
    assert.equal(r.steps('test_plan').status, 'ok');
    assert.equal(r.trackers.testPlans.length, 1);
    assert.equal(r.trackers.testPlans[0].test_plan_id, 'tp-9');
    assert.ok(r.report.includes('60%'), r.report);
  }],

  ['quality-triage：高严重度→te、其余负载均衡、建议模式文案、零写步骤', async () => {
    const r = await loadAndRun('quality', 'triage', { fixtures: { bugs: TRIAGE_BUGS } });
    assert.ok(r.steps('triage').status === 'ok' && !r.steps('bugs').write && !r.steps('triage').write);
    const triage = r.steps('triage').data as { openCount: number; highCount: number; restCount: number; owners: string[]; plan: { id: string; suggested: string; rule: string }[] };
    assert.equal(triage.openCount, 4, '未解 = t1..t4（t5 已解、t6 zzz）');
    assert.equal(triage.highCount, 1);
    assert.equal(triage.restCount, 3);
    assert.equal(triage.owners.join(','), 'alice,bob', '候选处理人池 = 未解缺陷的 current_owner 去重');
    const byId = new Map(triage.plan.map(p => [p.id, p]));
    assert.equal(byId.get('t1')!.suggested, 'tester-a', '高严重度 → te');
    assert.equal(byId.get('t1')!.rule, '高严重度→te');
    // 负载均衡：初始 alice=1(t3)/bob=1(t2)，依次分给当前负载最小者
    assert.equal(byId.get('t2')!.suggested, 'alice');
    assert.equal(byId.get('t3')!.suggested, 'bob');
    assert.equal(byId.get('t4')!.suggested, 'alice');
    assert.ok(byId.get('t4')!.rule === '按 current_owner 负载均衡');
    assert.ok(r.report.includes('建议模式'), r.report);
    assert.ok(r.report.includes('bug update'), '注明确认后人工/agent 执行 bug update');
    assert.ok(!r.report.includes('zzz-delete-me'), 'zzz 脏数据已过滤');
  }],

  ['risk-scan：六路命中 + 控制组排除 + 候选表（类别/描述/证据/建议等级）', async () => {
    // blocked/relations 自 L2 真机修复后为 opt-in（tcase_result/time_relative_stories 需实体级参数），
    // 显式传入三参以保持「六路命中」测试意图；默认缺省路径的降级见后续 dry-run/默认行为断言。
    const r = await loadAndRun('risk', 'scan', {
      vars: { tcase_id: 'tc-1', test_plan_id: 'tp-1', relations_story_id: '1139814312001001539' },
      fixtures: { bugs: SCAN_BUGS, stories: SCAN_STORIES },
    });
    assert.ok(r.steps('scan').status === 'ok');
    for (const id of ['tasks', 'bugs', 'blocked', 'stories', 'relations']) {
      assert.equal(r.steps(id).status, 'ok', `数据源 ${id} 执行`);
    }
    const scan = r.steps('scan').data as { total: number; categorySummary: string; findings: { category: string; kind: string; id: string; level: string; desc: string }[] };
    // ①k1 ④k1(50%→高)/k3(10%→中) ②g1 ③c1 ⑤r2+r3(迭代外) ⑥st2
    assert.equal(scan.total, 8);
    assert.ok(scan.categorySummary.includes('进度 1') && scan.categorySummary.includes('成本 2') && scan.categorySummary.includes('质量 2') && scan.categorySummary.includes('依赖 3'), scan.categorySummary);
    const kinds = scan.findings.map(f => f.kind);
    assert.equal(kinds.filter(k => k === '逾期任务').length, 1);
    assert.equal(kinds.filter(k => k === '超支任务').length, 2);
    assert.equal(kinds.filter(k => k === '逾期缺陷').length, 1);
    assert.equal(kinds.filter(k => k === '阻塞用例').length, 1);
    assert.equal(kinds.filter(k => k === '依赖停滞').length, 2);
    assert.equal(kinds.filter(k => k === '外部依赖').length, 1);
    const byId = new Map(scan.findings.map(f => [f.id + ':' + f.kind, f]));
    assert.equal(byId.get('k1:超支任务')!.level, '高', '超支 50% → 高');
    assert.equal(byId.get('k3:超支任务')!.level, '中', '超支 10% → 中');
    assert.equal(byId.get('g1:逾期缺陷')!.level, '高', 'severity=1 逾期缺陷 → 高');
    assert.ok(byId.get('st1:依赖停滞'), '后置 st1 的依赖停滞被命中');
    assert.ok(scan.findings.some(f => f.kind === '依赖停滞' && f.desc.includes('（迭代外）')), '迭代外前置也计入停滞');
    const report = r.report;
    assert.ok(report.includes('候选风险: 8 项'), report);
    assert.ok(report.includes('| 类别 | 类型 | 对象 | 描述 | 证据 | 建议等级 |'), '候选表列头');
    assert.ok(report.includes('人工裁决'), '注明输出供人工裁决');
    assert.ok(report.includes('pm risk register'), '去向：确认后用 risk register 登记');
    // 控制组不出现在报告
    for (const absent of ['任务B', '需求丙', 'g3', 'g2', 'zzz-delete-me']) {
      assert.ok(!report.includes(absent), `报告不含控制组/脏数据: ${absent}`);
    }
    assert.ok(r.steps('scan').write === false && scan.findings.length >= 0, '本模板零写步骤');
  }],

  ['risk-register：未 --yes 被写闸门拦截，零落库', async () => {
    const r = await loadAndRun('risk', 'register', {
      vars: { title: '联调环境不可用', category: '进度', probability: '高', impact: '里程碑延期', strategy: '规避', owner: 'alice', trigger: '环境连续 3 天不可用' },
    });
    assert.equal(r.trackers.createStory.length, 0, '未 --yes 不落库');
    assert.equal(r.steps('register').status, 'skipped');
  }],

  ['risk-register：--yes 落库【风险】需求，priority_label 按概率映射、description 组装完整', async () => {
    const r = await loadAndRun('risk', 'register', {
      yes: true,
      vars: { title: '联调环境不可用', category: '进度', probability: '高', impact: '里程碑延期', strategy: '规避', owner: 'alice', trigger: '环境连续 3 天不可用' },
    });
    assert.equal(r.trackers.createStory.length, 1);
    const args = r.trackers.createStory[0];
    assert.equal(args.name, '【风险】联调环境不可用');
    assert.equal(args.label, 'risk');
    assert.equal(args.iteration_id, '5001');
    assert.equal(args.priority_label, 'High', '概率「高」→ High');
    const desc = String(args.description);
    for (const frag of ['- 类别: 进度', '- 概率×影响: 高 × 里程碑延期（priority_label=High）', '- 触发条件: 环境连续 3 天不可用', '- 应对策略: 规避', '- 责任人: alice', '- 关联迭代: 5001', 'label=risk']) {
      assert.ok(desc.includes(frag), `描述含片段: ${frag}\n${desc}`);
    }
    assert.ok(r.report.includes('新需求 id: new-1'), r.report);
    assert.ok(r.report.includes('登记后会在范围度量中被剔除'), '报告注明范围度量剔除口径');
    assert.ok(r.report.includes('【风险】联调环境不可用'), '报告含 markdown 预览标题');
  }],

  ['risk-register：probability 低/未知 → Low/Middle 兜底', async () => {
    const low = await loadAndRun('risk', 'register', { yes: true, vars: { title: 'X', probability: 'low' } });
    assert.equal(low.trackers.createStory[0].priority_label, 'Low');
    const unknown = await loadAndRun('risk', 'register', { yes: true, vars: { title: 'Y', probability: '玄学' } });
    assert.equal(unknown.trackers.createStory[0].priority_label, 'Middle', '未识别概率默认 Middle');
  }],

  ['risk-register：缺 title 时写步骤被 where 跳过，报告注明补参方式', async () => {
    const r = await loadAndRun('risk', 'register', { yes: true, vars: { title: '' } });
    assert.equal(r.trackers.createStory.length, 0, '缺 title 不落库');
    const register = r.steps('register');
    assert.equal(register.status, 'skipped');
    assert.equal(register.skipReason, 'where');
    assert.ok(r.report.includes('被跳过'), r.report);
  }],

  ['CLI：pm list 收录四场景（builtin 来源）', async () => {
    const { registry } = makeRegistry();
    const program = buildProgram(registry, {});
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (c: unknown): boolean => { out.push(String(c)); return true; };
    const prev = process.exitCode;
    try {
      await program.parseAsync(['node', 'tapd', 'pm', 'list']);
    } finally {
      process.stdout.write = orig;
      process.exitCode = prev;
    }
    const list = out.join('');
    assert.match(list, /^quality\s+dashboard\s+read\s+builtin\s+/m);
    assert.match(list, /^quality\s+triage\s+read\s+builtin\s+/m);
    assert.match(list, /^risk\s+scan\s+read\s+builtin\s+/m);
    assert.match(list, /^risk\s+register\s+write\s+builtin\s+/m);
  }],

  ['CLI：pm quality dashboard --dry-run 打印预览且不执行业务步骤', async () => {
    const { registry, trackers } = makeRegistry();
    const program = buildProgram(registry, {});
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (c: unknown): boolean => { out.push(String(c)); return true; };
    const prev = process.exitCode ?? 0;
    try {
      await program.parseAsync(['node', 'tapd', 'pm', 'quality', 'dashboard', '--dry-run', '--iteration', '5001']);
    } finally {
      process.stdout.write = orig;
      process.exitCode = prev;
    }
    const preview = out.join('');
    assert.ok(preview.includes('dry-run'), preview);
    assert.ok(preview.includes('pipeline: quality-dashboard'), preview);
    assert.ok(preview.includes('[read]  bugs (tapd_get_bugs)'), preview);
    assert.equal(trackers.bugs.length, 0, 'dry-run 不执行业务步骤');
  }],

  ['CLI：pm risk register 未 --yes → WRITE_GATE 预览 + 退出码 2', async () => {
    const { registry, trackers } = makeRegistry();
    const program = buildProgram(registry, {});
    const out: string[] = [];
    const err: string[] = [];
    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    const prev = process.exitCode ?? 0;
    let code: number | undefined;
    try {
      process.stdout.write = (c: unknown): boolean => { out.push(String(c)); return true; };
      process.stderr.write = (c: unknown): boolean => { err.push(String(c)); return true; };
      await program.parseAsync(['node', 'tapd', 'pm', 'risk', 'register', '--iteration', '5001']);
      code = typeof process.exitCode === 'number' ? process.exitCode : undefined;
    } finally {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
      process.exitCode = prev;
    }
    assert.ok(err.join('').includes('WRITE_GATE'), err.join(''));
    assert.ok(out.join('').includes('write gate'), '闸门预览输出');
    assert.equal(code, 2, 'USAGE 退出码（写闸门拒绝）');
    assert.equal(trackers.createStory.length, 0);
  }],
];

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
  if (saved.userDir === undefined) delete process.env.TAPD_USER_TEMPLATES_DIR;
  else process.env.TAPD_USER_TEMPLATES_DIR = saved.userDir;
  if (saved.token === undefined) delete process.env.TAPD_ACCESS_TOKEN;
  else process.env.TAPD_ACCESS_TOKEN = saved.token;
  if (saved.richtext === undefined) delete process.env.TAPD_RICHTEXT_AUTO;
  else process.env.TAPD_RICHTEXT_AUTO = saved.richtext;
  rmSync(userDir, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
