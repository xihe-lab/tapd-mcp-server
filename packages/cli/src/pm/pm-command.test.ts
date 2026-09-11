// tapd pm 命令组集成测试（S2）：别名路由到 pipeline 引擎 / help 分组 / list / 写闸门 / 迭代注入
// fixture 模板写测试临时目录（TAPD_USER_TEMPLATES_DIR），registry 为 mock，不触真实 API。

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry } from '@xihe-lab/tapd-core';
import { buildProgram } from '../program.js';
import { CliError } from '../errors.js';

// ---- fixture 模板（用户目录，覆盖 env 注入） ----

const RISK_SCAN = `name: risk-scan
domain: risk
title: 风险扫描（fixture）
write: false
vars:
  iteration_id: ""
steps:
  - id: iterations
    uses: tapd_get_iterations
    args: { status: open, fields: "id,name,startdate" }
    filter: "!item.name.startsWith('zzz-delete-me')"
  - id: stories
    uses: tapd_get_stories
    args: { iteration_id: "${'$'}{vars.iteration_id}", fields: "id,name" }
    filter: "!item.name.startsWith('zzz-delete-me')"
`;

const SCOPE_CLOSE = `name: scope-close
domain: scope
title: 迭代关闭（fixture 写场景）
write: true
vars:
  iteration_id: ""
steps:
  - id: close
    uses: tapd_update_story
    args: { id: "${'$'}{vars.iteration_id}", status: closed }
`;

const PROCUREMENT_AUDIT = `name: procurement-audit
domain: procurement
title: 外部依赖台账（自定义域 fixture）
steps:
  - id: stories
    uses: tapd_get_stories
`;

// ---- mock registry ----

const OPEN_ITERATIONS = {
  data: [
    { id: '3001', name: 'Sprint A', startdate: '2026-09-01', status: 'open' },
    { id: '3003', name: 'zzz-delete-me 老迭代', startdate: '2026-12-31', status: 'open' },
    { id: '3002', name: 'Sprint B', startdate: '2026-09-10', status: 'open' },
  ],
};

interface Tracker {
  probes: Record<string, unknown>[];
  storyArgs: Record<string, unknown>[];
  updateArgs: Record<string, unknown>[];
}

function makeRegistry(): { registry: ToolRegistry; tracker: Tracker } {
  const tracker: Tracker = { probes: [], storyArgs: [], updateArgs: [] };
  const tools: ToolDef[] = [
    {
      name: 'tapd_get_iterations',
      description: 'mock: 迭代查询（pm 缺省迭代探测数据源）',
      inputSchema: z.object({
        workspace_id: z.number().optional(),
        status: z.string().optional(),
        fields: z.string().optional(),
      }),
      handler: (_client, params) => {
        tracker.probes.push(params as Record<string, unknown>);
        return Promise.resolve(OPEN_ITERATIONS);
      },
    },
    {
      name: 'tapd_get_stories',
      description: 'mock: 需求查询（记录入参，含 1 条 zzz 脏数据）',
      inputSchema: z.object({
        workspace_id: z.number().optional(),
        iteration_id: z.string().optional(),
        fields: z.string().optional(),
      }),
      handler: (_client, params) => {
        tracker.storyArgs.push(params as Record<string, unknown>);
        return Promise.resolve([
          { id: 's1', name: 'story-1' },
          { id: 's2', name: 'zzz-delete-me 脏数据' },
        ]);
      },
    },
    {
      name: 'tapd_update_story',
      description: 'mock: 写操作',
      write: true,
      inputSchema: z.object({
        workspace_id: z.number().optional(),
        id: z.string(),
        status: z.string().optional(),
      }),
      handler: (_client, params) => {
        tracker.updateArgs.push(params as Record<string, unknown>);
        return Promise.resolve({ id: (params as { id: string }).id });
      },
    },
  ];
  const registry = new ToolRegistry();
  registry.register(tools);
  return { registry, tracker };
}

// ---- stdout/stderr/exitCode 捕获 ----

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

async function runCli(registry: ToolRegistry, args: string[], config = {}): Promise<Captured> {
  const program = buildProgram(registry, config);
  // commander parse 约定 argv[0]=node argv[1]=script，真实参数从下标 2 开始
  return captureIo(async () => {
    await program.parseAsync(['node', 'tapd', ...args]);
  });
}

/**
 * help 路径（--help）：exitOverride 下 commander 打印后抛 helpDisplayed，
 * 输出已经落 stdout，吞掉该错误只取输出。
 * 注意 commander v13 的 addHelpText 走事件流，helpInformation() 不含 after 文本，
 * 必须经 parseAsync 才能拿到完整 help。
 */
async function runHelp(registry: ToolRegistry, args: string[]): Promise<Captured> {
  const program = buildProgram(registry, {});
  const out: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: unknown): boolean => {
    out.push(String(chunk));
    return true;
  };
  try {
    await program.parseAsync(['node', 'tapd', ...args]);
  } catch {
    // helpDisplayed / help 事件后的 CommanderError 属预期
  } finally {
    process.stdout.write = origOut;
  }
  return { out: out.join(''), err: '' };
}

// ---- fixture 目录 ----

const root = mkdtempSync(path.join(tmpdir(), 'tapd-pm-command-'));
mkdirSync(path.join(root, 'pm'), { recursive: true });
writeFileSync(path.join(root, 'pm', 'risk-scan.yaml'), RISK_SCAN);
writeFileSync(path.join(root, 'pm', 'scope-close.yaml'), SCOPE_CLOSE);
writeFileSync(path.join(root, 'pm', 'procurement-audit.yaml'), PROCUREMENT_AUDIT);
const prevEnv = process.env.TAPD_USER_TEMPLATES_DIR;
process.env.TAPD_USER_TEMPLATES_DIR = root;
// mock registry 不触 HTTP，但 registry.exec 会先构建 client（fromEnv 无凭证即抛 AUTH_MISSING）
const prevToken = process.env.TAPD_ACCESS_TOKEN;
process.env.TAPD_ACCESS_TOKEN = 'pm-test-token';

const checks: [string, () => void | Promise<void>][] = [
  ['tapd pm --help：八域分组（中文+章节号）、场景清单、自定义域归「其他」', async () => {
    const { registry } = makeRegistry();
    const program = buildProgram(registry, {});
    const pmCmd = program.commands.find(c => c.name() === 'pm');
    assert.ok(pmCmd, 'pm 命令已注册');
    // 域子命令逐一注册（含自定义域 procurement）
    for (const sub of ['list', 'integration', 'scope', 'schedule', 'cost', 'quality', 'communication', 'risk', 'stakeholder', 'procurement']) {
      assert.ok(pmCmd.commands.some(c => c.name() === sub), `pm 缺子命令 ${sub}`);
    }
    const io = await runHelp(registry, ['pm', '--help']);
    const help = io.out;
    for (const fragment of [
      'integration', 'scope', 'schedule', 'cost', 'quality', 'communication', 'risk', 'stakeholder',
      '整合管理（第8章）', '进度管理（第10章）', '沟通管理（第14章）', '干系人管理（第17章）',
      'scan              风险扫描（fixture） [read]',
      'close             迭代关闭（fixture 写场景） [write]',
      '其他', 'procurement/audit',
      '通用 flags:', '--iteration <id>', '--dry-run', '--yes', 'zzz-delete-me',
    ]) {
      assert.ok(help.includes(fragment), `help 缺片段: ${fragment}`);
    }
    const otherIdx = help.indexOf('其他');
    assert.ok(otherIdx > help.indexOf('stakeholder'), '「其他」组排在域表之后');
  }],
  ['tapd pm <domain> --help：该域场景清单', async () => {
    const { registry } = makeRegistry();
    const io = await runHelp(registry, ['pm', 'risk', '--help']);
    assert.ok(io.out.includes('risk 风险管理（第15章） 场景:'), io.out);
    assert.ok(io.out.includes('scan              风险扫描（fixture） [read]'));
    assert.ok(io.out.includes('用法: tapd pm risk <scenario>'));
  }],
  ['tapd pm：裸命令输出分组 help，退出码 0', async () => {
    const { registry } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm']));
    assert.ok(io.out.includes('域分组:'), io.err);
  }],
  ['tapd pm list：域/场景/读写/来源列；--domain 过滤；--output json', async () => {
    const { registry } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'list']));
    assert.ok(io.out.includes('domain') && io.out.includes('scenario'));
    assert.match(io.out, /^risk\s+scan\s+read\s+user\s+风险扫描（fixture）/m);
    assert.match(io.out, /^scope\s+close\s+write\s+user\s+迭代关闭（fixture 写场景）/m);

    const filtered = await withExitCode(() => runCli(registry, ['pm', 'list', '--domain', 'risk']));
    assert.ok(filtered.out.includes('scan') && !/\bclose\b/.test(filtered.out), '--domain 过滤');

    await assert.rejects(
      withExitCode(() => runCli(registry, ['pm', 'list', '--domain', 'nope'])),
      (error: unknown) => error instanceof CliError && error.message.includes('未知域 "nope"'),
    );

    const json = await withExitCode(() => runCli(registry, ['pm', 'list', '--output', 'json']));
    const entries = JSON.parse(json.out) as Record<string, unknown>[];
    assert.ok(entries.length >= 3);
    for (const e of entries) {
      for (const key of ['domain', 'scenario', 'name', 'write', 'file', 'source']) {
        assert.ok(key in e, `json 条目缺 ${key}`);
      }
    }
    assert.ok(entries.some(e => e.source === 'user' && e.domain === 'procurement'));
  }],
  ['别名执行 --dry-run：缺省迭代自动解析（3002）并注入 vars 预览，探测只读', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'risk', 'scan', '--dry-run']));
    assert.ok(io.out.includes('dry-run'), io.out);
    assert.ok(io.out.includes('"iteration_id": "3002"'), `预览应注入探测到的迭代: ${io.out}`);
    assert.ok(io.out.includes('[read]  stories (tapd_get_stories)'));
    assert.equal(tracker.probes.length, 1, '探测恰一次');
    assert.equal(tracker.probes[0].status, 'open');
    assert.equal(tracker.storyArgs.length, 0, 'dry-run 不执行业务步骤');
    assert.ok(io.err.includes('iteration: 自动选择 open 迭代 3002（Sprint B）'), io.err);
    assert.ok(tracker.probes[0].fields === 'id,name,startdate,status');
  }],
  ['--iteration 显式注入：跳过缺省探测', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'risk', 'scan', '--dry-run', '--iteration', '1001']));
    assert.equal(tracker.probes.length, 0, '显式 --iteration 不应探测');
    assert.ok(io.out.includes('"iteration_id": "1001"'), io.out);
    assert.ok(!io.err.includes('自动选择'));
  }],
  ['别名路由到 pipeline 引擎：真实执行 + zzz 过滤 + workspace_id 兜底注入', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() =>
      runCli(registry, ['pm', 'risk', 'scan', '--workspace-id', '39814312']),
    );
    assert.equal(tracker.storyArgs.length, 1);
    assert.deepEqual(tracker.storyArgs[0], { iteration_id: '3002', fields: 'id,name', workspace_id: 39814312 });
    // 默认 report：无模板 report 块时输出运行摘要（zzz 过滤后 stories 1 条；iterations 返回对象 → ok）
    assert.ok(io.out.includes('stories (tapd_get_stories): 1 条'), io.out);
    assert.ok(io.out.includes('iterations (tapd_get_iterations): ok'), io.out);
  }],
  ['写闸门：含写场景未 --yes 拒绝落库（退出码 2）+ 预览；--yes 后才执行', async () => {
    const { registry, tracker } = makeRegistry();
    const blocked = await withExitCode(() => runCli(registry, ['pm', 'scope', 'close']));
    assert.ok(blocked.err.includes('WRITE_GATE'), blocked.err);
    assert.ok(blocked.out.includes('write gate'));
    assert.equal(tracker.updateArgs.length, 0, '未 --yes 不得执行写步骤');

    const allowed = await withExitCode(() => runCli(registry, ['pm', 'scope', 'close', '--yes']));
    assert.equal(tracker.updateArgs.length, 1);
    assert.deepEqual(tracker.updateArgs[0], { id: '3002', status: 'closed' }, '写步骤拿到探测迭代注入的 vars');
    assert.ok(!allowed.err.includes('WRITE_GATE'));
  }],
  ['未知场景：CliError 列出该域可用场景', async () => {
    const { registry } = makeRegistry();
    await assert.rejects(
      withExitCode(() => runCli(registry, ['pm', 'risk', 'nope'])),
      (error: unknown) =>
        error instanceof CliError &&
        error.code === 'INVALID_ARGS' &&
        error.message.includes('域 risk 下没有场景 "nope"，可用场景: scan'),
    );
  }],
  ['自定义域可执行：pm procurement audit 走同一条别名链路', async () => {
    const { registry, tracker } = makeRegistry();
    const io = await withExitCode(() => runCli(registry, ['pm', 'procurement', 'audit', '--dry-run']));
    assert.ok(io.out.includes('procurement-audit'), io.out);
    assert.ok(io.out.includes('dry-run'));
    assert.ok(tracker.storyArgs.length === 0);
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
  rmSync(root, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
