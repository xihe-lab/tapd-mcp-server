// S6 场景模板测试：communication-weekly / communication-notify / stakeholder-map
//
// 被测对象是随包发布的内置模板（packages/cli/templates/pm/*.yaml），经真实发现链路
// （discoverPmTemplates → loadPmTemplate）加载，registry 为 mock，不触真实 API：
//   - weekly / map：只读场景，断言 report 口径（zzz/risk 过滤、比率保留分母、口径脚注、降级）
//   - notify：写场景，断言写闸门（无 --yes 退出码 2）+ <p> 包裹 + entry_type 归一化 + where 跳过
//   - 静态校验：loadPmTemplate（剥 domain）→ validateTemplate（参数 schema/引用/写标记）

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry } from '@xihe-lab/tapd-core';
import { buildProgram } from '../program.js';
import { discoverPmTemplates, loadPmTemplate, resolvePmEntry } from './discovery.js';
import { validateTemplate } from '../pipeline/validate.js';

// ---- 时间助手（与模板 window 口径一致）----

const DAY = 86400000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const TODAY = isoDay(0);
const YESTERDAY = isoDay(-1);
const TOMORROW = isoDay(1);
const at = (day: string, hm = '10:00:00'): string => `${day} ${hm}`;

// ---- mock 数据 ----

// 真实通道下 client.get 已解包 TAPD 信封，列表返回裸数组（tapd-client.ts unwrap）
const OPEN_ITERATIONS = [
  { id: '3001', name: 'Sprint A', startdate: '2026-09-01', enddate: '2026-09-15', status: 'open' },
  { id: '3003', name: 'zzz-delete-me 老迭代', startdate: '2026-12-31', status: 'open' },
  { id: '3002', name: 'Sprint B', startdate: '2026-09-10', enddate: '2026-09-24', status: 'open' },
];

const STORIES = [
  { id: 's1', name: '登录重构', owner: 'alice', cc: 'dave', participator: 'alice;bob', status: 'done', priority_label: 'high', created: at(TODAY, '09:00'), completed: at(TODAY, '18:00'), label: '' },
  { id: 's2', name: '导出优化', owner: 'bob;carol', cc: '', participator: '', status: 'developing', priority_label: 'mid', created: at('2026-01-01', '09:00'), completed: '', label: 'frontend' },
  { id: 's3', name: '支付联调', owner: 'alice', cc: '', participator: '', status: 'new', priority_label: 'high', created: at(TODAY, '11:00'), completed: '', label: '' },
  { id: 's9', name: 'zzz-delete-me 脏需求', owner: 'ghost', cc: '', participator: '', status: 'new', created: at(TODAY), completed: '', label: '' },
  { id: 's10', name: '【风险】洪水预警', owner: 'risk-owner', cc: '', participator: '', status: 'new', created: at(TODAY), completed: '', label: 'risk' },
];

const STORY_CHANGES = [
  { story_id: 's1', created: at(TODAY, '12:00'), author: 'alice' },
  { story_id: 's2', created: at(YESTERDAY, '12:00'), author: 'bob' },
  { story_id: 's3', created: '2020-01-01 08:00:00', author: 'carol' },
];

const BUGS = [
  { id: 'b1', title: '登录崩溃', severity: '1', current_owner: 'bob', status: 'new', created: at(TODAY, '09:30'), closed: '' },
  { id: 'b2', title: '文案错别字', severity: '3', current_owner: '', status: 'closed', created: '2026-08-01 09:00:00', closed: at(TODAY, '11:00') },
  { id: 'b3', title: 'zzz-delete-me 脏缺陷', severity: '2', current_owner: 'ghost', status: 'new', created: at(TODAY), closed: '' },
];

const TASKS = [
  { id: 't1', name: '接口联调', owner: 'alice', status: 'progressing', progress: 50, due: at(TOMORROW, '18:00') },
  { id: 't2', name: '回归测试', owner: 'bob', status: 'done', progress: 100, due: at(YESTERDAY, '18:00') },
  { id: 't3', name: '周报整理', owner: 'carol', status: 'open', progress: 0, due: at(YESTERDAY, '18:00') },
  { id: 't4', name: 'zzz-delete-me 脏任务', owner: 'ghost2', status: 'open', progress: 0, due: at(YESTERDAY, '18:00') },
];

const TIMESHEET_ROWS = [
  { owner: 'alice', spentdate: at(TODAY, '00:00'), timespent: '8', entity_type: 'story', entity_id: 's1' },
  { owner: 'alice', spentdate: at(YESTERDAY, '00:00'), timespent: 6, entity_type: 'task', entity_id: 't1' },
  { owner: 'bob', spentdate: at(TODAY, '00:00'), timespent: '4.5', entity_type: 'bug', entity_id: 'b1' },
  { owner: 'ghost9', spentdate: '2020-01-01 00:00:00', timespent: '99', entity_type: 'story', entity_id: 's-old' },
];

const USERS = [{ user: 'alice', role_id: '1' }, { user: 'bob', role_id: '1' }, { user: 'carol', role_id: '2' }, { user: 'dave', role_id: '2' }, { user: 'nobody', role_id: '3' }];

interface Tracker {
  probes: Record<string, unknown>[];
  storiesArgs: Record<string, unknown>[];
  changesArgs: Record<string, unknown>[];
  bugsArgs: Record<string, unknown>[];
  tasksArgs: Record<string, unknown>[];
  timesheetsArgs: Record<string, unknown>[];
  usersArgs: Record<string, unknown>[];
  commentArgs: Record<string, unknown>[];
}

function optStr(schema: Record<string, z.ZodTypeAny>): z.ZodTypeAny {
  return z.object(schema).passthrough();
}

function makeRegistry(): { registry: ToolRegistry; tracker: Tracker } {
  const tracker: Tracker = {
    probes: [], storiesArgs: [], changesArgs: [], bugsArgs: [],
    tasksArgs: [], timesheetsArgs: [], usersArgs: [], commentArgs: [],
  };
  const str = z.string().optional();
  const num = z.number().optional();
  const tools: ToolDef[] = [
    {
      name: 'tapd_get_iterations',
      description: 'mock: 迭代查询（缺省迭代探测数据源）',
      inputSchema: optStr({ workspace_id: z.number().optional(), id: str, status: str, fields: str }),
      handler: (_c, p) => {
        tracker.probes.push(p as Record<string, unknown>);
        return Promise.resolve(OPEN_ITERATIONS);
      },
    },
    {
      name: 'tapd_get_stories',
      description: 'mock: 需求查询（含 zzz 脏数据与风险项）',
      inputSchema: optStr({ workspace_id: z.number().optional(), iteration_id: str, fields: str, limit: num }),
      handler: (_c, p) => {
        tracker.storiesArgs.push(p as Record<string, unknown>);
        return Promise.resolve(STORIES);
      },
    },
    {
      name: 'tapd_get_story_changes',
      description: 'mock: 需求变更（含窗外旧数据）',
      inputSchema: optStr({ workspace_id: z.number().optional(), limit: num, fields: str }),
      handler: (_c, p) => {
        tracker.changesArgs.push(p as Record<string, unknown>);
        return Promise.resolve(STORY_CHANGES);
      },
    },
    {
      name: 'tapd_get_bugs',
      description: 'mock: 缺陷查询（含 zzz 脏数据）',
      inputSchema: optStr({ workspace_id: z.number().optional(), iteration_id: str, fields: str, limit: num }),
      handler: (_c, p) => {
        tracker.bugsArgs.push(p as Record<string, unknown>);
        return Promise.resolve(BUGS);
      },
    },
    {
      name: 'tapd_get_tasks',
      description: 'mock: 任务查询（含 zzz 脏数据与停滞任务）',
      inputSchema: optStr({ workspace_id: z.number().optional(), iteration_id: str, fields: str, limit: num }),
      handler: (_c, p) => {
        tracker.tasksArgs.push(p as Record<string, unknown>);
        return Promise.resolve(TASKS);
      },
    },
    {
      name: 'tapd_get_timesheets',
      description: 'mock: 工时（按 spentdate >= 窗口过滤，模拟服务端时间查询）',
      inputSchema: optStr({ workspace_id: z.number().optional(), spentdate: str, fields: str, limit: num }),
      handler: (_c, p) => {
        const args = p as Record<string, unknown>;
        tracker.timesheetsArgs.push(args);
        const m = /^>=\s*(\d{4}-\d{2}-\d{2})/.exec(String(args.spentdate ?? ''));
        const since = m ? m[1] : '';
        return Promise.resolve(TIMESHEET_ROWS.filter(r => !since || String(r.spentdate).slice(0, 10) >= since));
      },
    },
    {
      name: 'tapd_get_workspace_users',
      description: 'mock: 成员名单（含零参与成员 nobody）',
      inputSchema: optStr({ workspace_id: z.number().optional(), fields: str }),
      handler: (_c, p) => {
        tracker.usersArgs.push(p as Record<string, unknown>);
        return Promise.resolve(USERS);
      },
    },
    {
      name: 'tapd_create_comment',
      description: 'mock: 写评论',
      write: true,
      inputSchema: optStr({ workspace_id: z.number().optional(), entry_type: z.string(), entry_id: z.string(), description: z.string(), cc: str }),
      handler: (_c, p) => {
        tracker.commentArgs.push(p as Record<string, unknown>);
        return Promise.resolve({ id: 'c-1', entry_id: (p as { entry_id: string }).entry_id });
      },
    },
  ];
  const registry = new ToolRegistry();
  registry.register(tools);
  return { registry, tracker };
}

// ---- stdout/stderr/exitCode 捕获（与 pm-command.test.ts 同构）----

interface Captured {
  out: string;
  err: string;
}

function captureIo(run: () => Promise<void>): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk: unknown): boolean => {
    out.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk: unknown): boolean => {
    err.push(String(chunk));
    return true;
  };
  return run().then(
    () => {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
      return { out: out.join(''), err: err.join('') };
    },
    error => {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
      throw error;
    },
  );
}

async function withExitCode<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.exitCode;
  try {
    return await fn();
  } finally {
    process.exitCode = prev;
  }
}

async function runCli(registry: ToolRegistry, args: string[]): Promise<Captured> {
  const program = buildProgram(registry, {});
  return captureIo(async () => {
    await program.parseAsync(['node', 'tapd', ...args]);
  });
}

// ---- 环境隔离：用户模板目录指向空目录，凭证注入 mock 通道所需 ----

const emptyUserDir = mkdtempSync(path.join(tmpdir(), 'tapd-s6-tpl-'));
const prevEnv = process.env.TAPD_USER_TEMPLATES_DIR;
const prevToken = process.env.TAPD_ACCESS_TOKEN;
process.env.TAPD_USER_TEMPLATES_DIR = emptyUserDir;
process.env.TAPD_ACCESS_TOKEN = 's6-tpl-test-token';

const checks: [string, () => void | Promise<void>][] = [
  ['发现：三个内置场景被收录，读写标记与 title 纪律齐备', () => {
    const catalog = discoverPmTemplates();
    assert.equal(catalog.warnings.length, 0, `发现不应有 warning: ${catalog.warnings.join('; ')}`);
    const weekly = resolvePmEntry(catalog, 'communication', 'weekly');
    const notify = resolvePmEntry(catalog, 'communication', 'notify');
    const map = resolvePmEntry(catalog, 'stakeholder', 'map');
    for (const e of [weekly, notify, map]) assert.equal(e.source, 'builtin', `${e.name} 应为内置模板`);
    assert.equal(weekly.write, false);
    assert.equal(notify.write, true);
    assert.equal(map.write, false);
    assert.ok(weekly.title.includes('数据稿') && weekly.title.includes('wiki 落库'), 'weekly title 注明数据稿与 wiki 落库');
    assert.ok(notify.title.includes('人审') && notify.title.includes('--yes'), 'notify title 注明措辞人审 + --yes');
    assert.ok(map.title.includes('403') && map.title.includes('降级'), 'map title 注明 403 权限与降级');
  }],

  ['静态校验：loadPmTemplate（剥 domain）→ validateTemplate 对 mock registry 全绿', () => {
    const catalog = discoverPmTemplates();
    const registry = makeRegistry().registry;
    for (const [domain, scenario] of [['communication', 'weekly'], ['communication', 'notify'], ['stakeholder', 'map']] as const) {
      const entry = resolvePmEntry(catalog, domain, scenario);
      const { template, path } = loadPmTemplate(entry);
      assert.ok(path.endsWith(`${domain}-${scenario}.yaml`), path);
      assert.equal('domain' in template, false, 'pm 元数据字段应被剥离');
      const result = validateTemplate(template, registry);
      assert.deepEqual(result.errors, [], `${template.name} 校验错误: ${JSON.stringify(result.errors)}`);
      assert.deepEqual(result.writeSteps, template.write ? ['comment'] : [], `${template.name} 写步骤清单`);
    }
  }],

  ['weekly dry-run：计划预览含全部只读步骤与过滤声明，不执行业务步骤', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'communication', 'weekly', '--dry-run', '--iteration', '3001']));
    assert.ok(io.out.includes('dry-run'), io.out);
    assert.ok(io.out.includes('"iteration_id": "3001"'), io.out);
    for (const fragment of ['stories (tapd_get_stories)', 'story_changes (tapd_get_story_changes)', 'timesheets (tapd_get_timesheets)', 'weekly (expr)']) {
      assert.ok(io.out.includes(fragment), `预览缺 ${fragment}`);
    }
    assert.ok(io.out.includes("zzz-delete-me"), '预览应展示 zzz 过滤声明');
    assert.ok(!io.out.includes('[write]'), 'weekly 无写步骤');
    assert.equal(tracker.storiesArgs.length, 0, 'dry-run 不执行业务步骤');
  }],

  ['weekly 真实执行：数据稿口径（zzz/风险剔除、比率保留分母、口径脚注、主观补充空章节）', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'communication', 'weekly', '--iteration', '3001', '--workspace-id', '39814312']));
    assert.equal(tracker.storiesArgs.length, 1, 'stories 恰执行一次');
    assert.deepEqual(tracker.storiesArgs[0], {
      iteration_id: '3001',
      fields: 'id,name,owner,status,priority_label,created,completed,label',
      limit: 200,
      workspace_id: 39814312,
    }, `stories 入参: ${JSON.stringify(tracker.storiesArgs[0])}`);

    const report = io.out;
    assert.ok(report.includes('# 迭代周报（数据稿）'), report);
    assert.ok(report.includes('数据稿，人工补充后可选 wiki 落库'), report);
    assert.ok(report.includes('迭代: Sprint A（2026-09-01 ~ 2026-09-15）'), `迭代元信息: ${report}`);
    // zzz / 风险项剔除：脏数据与风险名称不得出现
    assert.ok(!report.includes('zzz-delete-me 脏需求'), 'zzz 脏需求应被过滤');
    assert.ok(!report.includes('【风险】洪水预警'), '风险项应被剔除');
    // 需求口径：3 条有效，1 done → 完成度保留分母 1/3；新增 2（s1/s3 本窗创建）、关闭 1（s1 completed）
    assert.ok(report.includes('完成度 1/3'), report);
    assert.ok(report.includes('本周新增 2 / 本周关闭 1'), report);
    assert.ok(report.includes('changes 近似核对: 2 条'), report);
    // 缺陷口径：2 条有效，已关闭 1/2，本周新增 1 / 关闭 1
    assert.ok(report.includes('已关闭 1/2'), report);
    assert.ok(report.includes('本周新增 1 / 本周关闭 1'), report);
    assert.ok(!report.includes('zzz-delete-me 脏缺陷'), 'zzz 脏缺陷应被过滤');
    // 任务口径：3 条有效 1 完成，未启动 1，逾期 1，平均进度 50%
    assert.ok(report.includes('完成 1/3'), report);
    assert.ok(report.includes('未启动 1'), report);
    assert.ok(report.includes('逾期未完成 1'), report);
    assert.ok(report.includes('平均进度 50%'), report);
    // 工时：窗口内 alice 8+6=14、bob 4.5（ghost9 的 2020 记录被服务端窗口过滤）
    assert.ok(report.includes('合计 18.5 小时 / 2 人'), report);
    assert.ok(report.includes('| alice | 14 | 2 |'), report);
    // 固定脚注段 + 人工补充空章节
    assert.ok(report.includes('## 口径脚注'), report);
    for (const fragment of ['统计范围:', '过滤项:', '数据时间:', '完成度定义:']) {
      assert.ok(report.includes(fragment), `口径脚注缺 ${fragment}`);
    }
    assert.ok(report.includes('## 主观补充'), report);
    assert.equal(tracker.commentArgs.length, 0, 'weekly 不得触发写操作');
  }],

  ['weekly 缺省迭代：自动探测最新 open 迭代（zzz 老迭代不参与）并注入 vars', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'communication', 'weekly']));
    // probe 与模板自身的 iteration 步骤都打 tapd_get_iterations：按探测签名区分
    const probeCalls = tracker.probes.filter(p => p.fields === 'id,name,startdate,status');
    assert.equal(probeCalls.length, 1, '探测恰一次');
    assert.equal(probeCalls[0].status, 'open');
    assert.ok(io.err.includes('iteration: 自动选择 open 迭代 3002'), io.err);
    assert.equal((tracker.storiesArgs[0] as { iteration_id: string }).iteration_id, '3002');
  }],

  ['notify 写闸门：无 --yes 退出码 2、输出写预览、不触 API', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() =>
      runCli(registry, ['pm', 'communication', 'notify', '--iteration', '3001', '--input', '{"entry_type":"stories","entry_id":"1140000001","message":"需求已延期一周","cc":"alice|bob"}']),
    );
    assert.ok(io.out.includes('write gate'), io.out);
    assert.ok(io.out.includes('[write] comment (tapd_create_comment)'), io.out);
    assert.ok(io.err.includes('WRITE_GATE'), io.err);
    assert.equal(tracker.commentArgs.length, 0, '未 --yes 不得创建评论');
  }],

  ['notify --yes：纯文本包 <p>、entry_type 透传、cc 透传，回执含评论 ID', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() =>
      runCli(registry, ['pm', 'communication', 'notify', '--yes', '--input', '{"entry_type":"stories","entry_id":"1140000001","message":"需求已延期一周，请大家知悉","cc":"alice|bob"}']),
    );
    assert.equal(tracker.commentArgs.length, 1);
    const args = tracker.commentArgs[0] as { entry_type: string; entry_id: string; description: string; cc: string };
    assert.equal(args.entry_type, 'stories');
    assert.equal(args.entry_id, '1140000001');
    assert.equal(args.description, '<p>需求已延期一周，请大家知悉</p>', '纯文本必须包 <p>');
    assert.equal(args.cc, 'alice|bob');
    assert.ok(io.out.includes('# 变更通知回执'), io.out);
    assert.ok(io.out.includes('c-1'), '回执应含评论 ID');
    assert.ok(io.out.includes('已包 <p> 标签'), io.out);
  }],

  ['notify --yes：HTML 正文不二次包裹；entry_type 别名归一化（task→tasks）', async () => {
    const { registry, tracker } = makeRegistry();
    await withExitCode(() =>
      runCli(registry, ['pm', 'communication', 'notify', '--yes', '--input', '{"entry_type":"task","entry_id":"1140000002","message":"<p>任务已上线</p>"}']),
    );
    assert.equal(tracker.commentArgs.length, 1);
    const args = tracker.commentArgs[0] as { entry_type: string; description: string };
    assert.equal(args.description, '<p>任务已上线</p>', '已是 HTML 不得二次包裹');
    assert.equal(args.entry_type, 'tasks', '单数别名应归一化为 tasks');
  }],

  ['notify --yes 但 message 为空：写步骤被 where 跳过，不触 API', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() =>
      runCli(registry, ['pm', 'communication', 'notify', '--yes', '--output', 'json', '--input', '{"entry_type":"stories","entry_id":"1140000001","message":""}']),
    );
    assert.equal(tracker.commentArgs.length, 0, '空 message 不应创建评论');
    const summary = JSON.parse(io.out) as { ok: boolean; steps: { id: string; status: string; skipReason?: string }[] };
    assert.equal(summary.ok, true);
    const comment = summary.steps.find(s => s.id === 'comment');
    assert.equal(comment?.status, 'skipped');
    assert.equal(comment?.skipReason, 'where');
  }],

  ['map 真实执行：人×参与对象数×角色视角矩阵、沉默干系人、零参与成员', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'stakeholder', 'map', '--iteration', '3001']));
    assert.equal(tracker.usersArgs.length, 1, 'users 接口恰调用一次');
    assert.equal(tracker.storiesArgs.length, 1);

    const report = io.out;
    assert.ok(report.includes('# 干系人参与矩阵'), report);
    assert.ok(report.includes('名单接口可用，共 5 人'), report);
    assert.ok(!report.includes('ghost'), 'zzz 脏数据 owner 不得入矩阵');
    // alice: 需求负责 2（s1/s3）+ 需求参与 1（s1 participator）+ 任务负责 1 = 4 个参与对象
    assert.ok(report.includes('| alice | 2 | 0 | 1 | 1 | 0 | 4 |'), `alice 行口径: ${report}`);
    // dave: 仅 s1 的 cc → 1 个参与对象
    assert.ok(report.includes('| dave | 0 | 1 | 0 | 0 | 0 | 1 |'), `dave 行口径: ${report}`);
    // carol: 需求负责 1（s2）+ 任务负责 1，且名下有停滞任务（progress=0 且 due 已过）→ 沉默标记
    assert.ok(report.includes('是（周报整理）'), `carol 沉默标记: ${report}`);
    assert.ok(report.includes('## 沉默干系人'), report);
    assert.ok(report.includes('- carol（停滞任务: 周报整理）'), report);
    // nobody 在册但未出现在任何参与字段 → 零参与成员
    assert.ok(report.includes('## 零参与名单成员'), report);
    assert.ok(report.includes('- nobody'), report);
    assert.ok(!report.includes('- dave\n'), 'dave 已有 cc 参与，不应入零参与清单');
  }],

  ['map 降级：--input skip_users=true 时 users 不调用，矩阵从存量 owner 字段反推', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'stakeholder', 'map', '--iteration', '3001', '--input', '{"skip_users":true}']));
    assert.equal(tracker.usersArgs.length, 0, 'skip_users=true 不得调用 users 接口');
    const report = io.out;
    assert.ok(report.includes('降级模式'), report);
    assert.ok(report.includes('仅从存量 owner/cc/participator 字段反推'), report);
    assert.ok(!report.includes('nobody'), '降级模式无名单，不应出现零参与成员');
    assert.ok(report.includes('| alice | 2 | 0 | 1 | 1 | 0 | 4 |'), '降级模式下矩阵仍由 owner/cc/participator 字段构成');
    assert.ok(report.includes('是（周报整理）'), '沉默判定不依赖名单接口');
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
  if (prevEnv === undefined) delete process.env.TAPD_USER_TEMPLATES_DIR;
  else process.env.TAPD_USER_TEMPLATES_DIR = prevEnv;
  if (prevToken === undefined) delete process.env.TAPD_ACCESS_TOKEN;
  else process.env.TAPD_ACCESS_TOKEN = prevToken;
  rmSync(emptyUserDir, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
