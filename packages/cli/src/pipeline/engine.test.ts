import assert from 'node:assert/strict';
import { z } from 'zod';
import type { TapdClient, ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry } from '@xihe-lab/tapd-core';
import { buildPreview, runPipeline } from './engine.js';
import type { PipelineEvent, PipelineTemplate } from './types.js';
import { PipelineError } from './types.js';
import { parseTemplate } from './template.js';

interface Fixture {
  registry: ToolRegistry;
  executed: string[];
  peakActive: { value: number };
}

function makeRegistry(): Fixture {
  const executed: string[] = [];
  const peakActive = { value: 0 };
  const active = { value: 0 };
  const track = (name: string, fn: () => Promise<unknown>): Promise<unknown> => {
    active.value++;
    peakActive.value = Math.max(peakActive.value, active.value);
    return fn()
      .then(result => {
        executed.push(name);
        return result;
      })
      .finally(() => {
        active.value--;
      });
  };
  const tools: ToolDef[] = [
    {
      name: 'tapd_get_stories',
      description: 'read: 按 iteration_id 拉需求（返回计数）',
      inputSchema: z.object({ iteration_id: z.string().optional(), limit: z.number().optional(), fields: z.string().optional() }),
      handler: (_client, params) =>
        track('tapd_get_stories', () =>
          Promise.resolve({
            count: (params as { limit?: number }).limit ?? 3,
            iteration: (params as { iteration_id?: string }).iteration_id ?? 'unset',
          })),
    },
    {
      name: 'tapd_get_bugs',
      description: 'read: 拉缺陷（返回固定数组）',
      inputSchema: z.object({ status: z.string().optional(), fields: z.string().optional() }),
      handler: () =>
        track('tapd_get_bugs', () =>
          Promise.resolve([
            { id: 'b1', title: 'bug-1', current_owner: '' },
            { id: 'b2', title: 'zzz-delete-me', current_owner: '' },
            { id: 'b3', title: 'bug-3', current_owner: 'qa' },
          ])),
    },
    {
      name: 'tapd_update_story',
      description: 'write: 状态扭转',
      write: true,
      inputSchema: z.object({ id: z.string(), status: z.string().optional() }),
      handler: (_client, params) => track('tapd_update_story', () => Promise.resolve({ patched: params as Record<string, unknown> })),
    },
    {
      name: 'tapd_boom',
      description: 'write: 必失败的写步骤',
      write: true,
      inputSchema: z.object({}),
      handler: () => track('tapd_boom', () => Promise.reject(new Error('TAPD API error: mock down'))),
    },
  ];
  const registry = new ToolRegistry();
  registry.register(tools);
  return { registry, executed, peakActive };
}

function clientFactory(): TapdClient {
  return {} as TapdClient; // mock handler 不触达 client
}

function tpl(yaml: string): PipelineTemplate {
  return parseTemplate(yaml, 'inline');
}

const nodesOf = (t: PipelineTemplate, registry: ToolRegistry) =>
  // planWaves 接收 StepNode[]；测试经由 buildPreview 间接构造，保持单一构建路径
  buildPreview(t, registry, {});

const checks: [string, () => void | Promise<void>][] = [
  ['planWaves: 无依赖步骤同波次，依赖串行排后', () => {
    const t = tpl(`
name: waves
write: false
steps:
  - id: a
    uses: tapd_get_stories
    args: { iteration_id: "1" }
  - id: b
    uses: tapd_get_bugs
  - id: c
    uses: tapd_update_story
    args: { id: "${'$'}{steps.a.data.count}" }
    depends_on: [a, b]
`);
    const preview = nodesOf(t, makeRegistry().registry);
    const waves = [...new Set(preview.map(p => p.wave))].sort();
    assert.deepEqual(waves, [0, 1]);
    assert.deepEqual(preview.filter(p => p.wave === 0).map(p => p.id).sort(), ['a', 'b']);
    assert.deepEqual(preview.filter(p => p.wave === 1).map(p => p.id), ['c']);
    assert.equal(preview.find(p => p.id === 'c')!.write, true);
  }],
  ['planWaves: 循环依赖 → DEPENDENCY_CYCLE', () => {
    const t = tpl(`
name: cycle
write: false
steps:
  - id: a
    uses: tapd_get_stories
    args: { id: "${'$'}{steps.b.data}" }
  - id: b
    uses: tapd_get_stories
    args: { id: "${'$'}{steps.a.data}" }
`);
    assert.throws(
      () => buildPreview(t, makeRegistry().registry, {}),
      (error: unknown) => error instanceof PipelineError && error.code === 'DEPENDENCY_CYCLE',
    );
  }],
  ['runPipeline: 纯只读模板直接执行，无需 --yes', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: read-only
write: false
steps:
  - id: stories
    uses: tapd_get_stories
    args: { iteration_id: "1001" }
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory });
    assert.equal(summary.ok, true);
    assert.equal(summary.dryRun, false);
    assert.equal(summary.gateBlocked, false);
    assert.deepEqual(fx.executed, ['tapd_get_stories']);
    assert.deepEqual(summary.steps.map(s => s.status), ['ok']);
  }],
  ['写闸门: 含写步骤未 --yes → 拒绝执行 + 预览 + gateBlocked', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: gated
write: true
steps:
  - id: fetch
    uses: tapd_get_stories
    args: { iteration_id: "1001" }
  - id: patch
    uses: tapd_update_story
    args: { id: "123", status: developing }
    depends_on: [fetch]
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory });
    assert.equal(summary.ok, false);
    assert.equal(summary.gateBlocked, true);
    assert.equal(summary.dryRun, true);
    assert.deepEqual(fx.executed, [], '写闸门下任何步骤都不得执行');
    assert.equal(summary.preview?.length, 2);
    const patch = summary.preview?.find(p => p.id === 'patch');
    assert.ok(patch);
    assert.equal(patch.write, true);
    assert.deepEqual(patch.args, { id: '123', status: 'developing' });
    assert.ok(summary.report!.includes('write gate'));
    assert.ok(summary.report!.includes('[write]'));
  }],
  ['写闸门: --yes 放行，写步骤真实执行', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: gated-yes
write: true
steps:
  - id: patch
    uses: tapd_update_story
    args: { id: "123", status: developing }
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory, yes: true });
    assert.equal(summary.ok, true);
    assert.equal(summary.gateBlocked, false);
    assert.deepEqual(fx.executed, ['tapd_update_story']);
  }],
  ['--dry-run: 只读模板也只出预览不执行', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: explicit-dry
write: false
steps:
  - id: bugs
    uses: tapd_get_bugs
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory, dryRun: true });
    assert.equal(summary.ok, true, '显式 --dry-run 是合法请求，退出码应为 0');
    assert.equal(summary.dryRun, true);
    assert.equal(summary.gateBlocked, false);
    assert.deepEqual(fx.executed, []);
    assert.equal(summary.preview?.[0].id, 'bugs');
  }],
  ['变量注入: --input 覆盖模板 vars，步骤参数取到注入值', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: vars-inject
write: false
vars:
  iteration_id: "template-default"
  limit: 1
steps:
  - id: stories
    uses: tapd_get_stories
    args:
      iteration_id: "${'$'}{vars.iteration_id}"
      limit: "${'$'}{vars.limit}"
`);
    const summary = await runPipeline(t, {
      registry: fx.registry,
      clientFactory,
      vars: { iteration_id: 'from-input', limit: 9 },
    });
    assert.equal(summary.ok, true);
    const outcome = summary.steps[0];
    assert.deepEqual(JSON.parse(JSON.stringify(outcome.data)), { count: 9, iteration: 'from-input' });
  }],
  ['步骤引用: 后续步骤消费前序输出，filter 生效', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: chained
write: false
steps:
  - id: bugs
    uses: tapd_get_bugs
    filter: "!item.title.startsWith('zzz-delete-me')"
  - id: summary
    expr: "({ unassigned: steps.bugs.data.filter(b => !b.current_owner).length, total: steps.bugs.data.length })"
    depends_on: [bugs]
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory });
    assert.equal(summary.ok, true);
    assert.equal((summary.steps[0].data as { length: number }).length, 2, 'zzz-delete-me 被过滤');
    assert.deepEqual(JSON.parse(JSON.stringify(summary.steps[1].data)), { unassigned: 1, total: 2 });
  }],
  ['where: 表达式为假时跳过且不执行工具', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: where-skip
write: false
steps:
  - id: bugs
    uses: tapd_get_bugs
  - id: patch
    uses: tapd_update_story
    args: { id: "x" }
    where: "steps.bugs.data.length > 999"
    depends_on: [bugs]
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory, yes: true });
    assert.equal(summary.ok, true, 'where 跳过不算失败');
    assert.equal(summary.steps[1].status, 'skipped');
    assert.equal(summary.steps[1].skipReason, 'where');
    assert.deepEqual(fx.executed, ['tapd_get_bugs']);
  }],
  ['并发: 无依赖步骤同波次并行（峰值活跃数 > 1）', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: parallel
write: false
steps:
  - id: a
    uses: tapd_get_stories
    args: { iteration_id: "1" }
  - id: b
    uses: tapd_get_bugs
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory });
    assert.equal(summary.ok, true);
    assert.ok(fx.peakActive.value >= 2, `期望两个步骤并发，峰值活跃=${fx.peakActive.value}`);
  }],
  ['失败中止: 步骤失败 → 下游依赖跳过，独立步骤照常完成，ok=false', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: fail-fast
write: true
steps:
  - id: boom
    uses: tapd_boom
  - id: patch
    uses: tapd_update_story
    args: { id: "1" }
    depends_on: [boom]
  - id: after
    uses: tapd_get_stories
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory, yes: true });
    assert.equal(summary.ok, false);
    const boom = summary.steps.find(s => s.id === 'boom')!;
    assert.equal(boom.status, 'failed');
    assert.match(boom.error!.message, /mock down/);
    const patch = summary.steps.find(s => s.id === 'patch')!;
    assert.equal(patch.status, 'skipped');
    assert.equal(patch.skipReason, 'pipeline-failed');
    assert.equal(summary.steps.find(s => s.id === 'after')!.status, 'ok', '无依赖的独立步骤不受兄弟失败影响');
    assert.deepEqual([...fx.executed].sort(), ['tapd_get_stories'], 'executed 只记成功执行');
    assert.ok(!fx.executed.includes('tapd_update_story'), '下游写步骤不得执行');
  }],
  ['readOnly: 传入 ExecContext.readOnly，registry 拦截写步骤', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: ro-block
write: true
steps:
  - id: patch
    uses: tapd_update_story
    args: { id: "1", status: developing }
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory, yes: true, readOnly: true });
    assert.equal(summary.ok, false);
    const patch = summary.steps[0];
    assert.equal(patch.status, 'failed');
    assert.match(patch.error!.message, /READ_ONLY_BLOCKED/);
  }],
  ['事件流: JSONL 覆盖 pipeline/step 全生命周期（执行与跳过路径）', async () => {
    const fx = makeRegistry();
    const captured: { path: string; content: string }[] = [];
    const t = tpl(`
name: events-demo
write: false
steps:
  - id: bugs
    uses: tapd_get_bugs
  - id: skipped
    uses: tapd_update_story
    args: { id: "x" }
    where: "false"
    depends_on: [bugs]
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory, yes: true, eventsPath: '/tmp/x.jsonl' }, (path, content) => captured.push({ path, content }));
    assert.equal(summary.ok, true);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].path, '/tmp/x.jsonl');
    const events = captured[0].content.trimEnd().split('\n').map(l => JSON.parse(l) as PipelineEvent);
    assert.deepEqual(events.map(e => e.event), ['pipeline.start', 'step.start', 'step.end', 'step.skip', 'pipeline.end']);
    assert.equal(events[2].step, 'bugs');
    assert.equal(events[3].step, 'skipped');
    assert.equal(events[3].skipReason, 'where');
    assert.ok(events.every(e => e.pipeline === 'events-demo'));
  }],
  ['事件流: 写闸门路径输出 dry-run 事件', async () => {
    const fx = makeRegistry();
    const captured: { path: string; content: string }[] = [];
    const t = tpl(`
name: gate-events
write: true
steps:
  - id: patch
    uses: tapd_update_story
    args: { id: "1" }
`);
    await runPipeline(t, { registry: fx.registry, clientFactory, eventsPath: 'gate.jsonl' }, (path, content) => captured.push({ path, content }));
    const events = captured[0].content.trimEnd().split('\n').map(l => JSON.parse(l) as PipelineEvent);
    assert.equal(events[0].event, 'pipeline.dry-run');
    assert.equal(events[1].event, 'step.skip');
    assert.equal(events[1].skipReason, 'dry-run');
    assert.equal(events.at(-1)!.event, 'pipeline.gate-blocked');
    assert.deepEqual(fx.executed, []);
  }],
  ['report: 模板 report.template 插值渲染（含 rows 过滤器）', async () => {
    const fx = makeRegistry();
    const t = tpl(`
name: report-demo
write: false
steps:
  - id: bugs
    uses: tapd_get_bugs
report:
  format: markdown
  template: |
    # 缺陷
    总数 ${'$'}{steps.bugs.data | length}
    ${'$'}{steps.bugs.data | rows id,title}
`);
    const summary = await runPipeline(t, { registry: fx.registry, clientFactory });
    assert.match(summary.report!, /# 缺陷/);
    assert.match(summary.report!, /总数 3/);
    assert.match(summary.report!, /\| b1 \| bug-1 \|/);
  }],
  ['defaultArgs: workspace_id 兜底注入，步骤显式值优先', async () => {
    const seen: unknown[] = [];
    const registry = new ToolRegistry();
    registry.register([
      {
        name: 'tapd_probe',
        description: 'capture args',
        inputSchema: z.object({ workspace_id: z.number().optional() }),
        handler: (_c, params) => {
          seen.push((params as { workspace_id?: number }).workspace_id);
          return Promise.resolve('ok');
        },
      },
    ]);
    const t = tpl(`
name: default-args
write: false
steps:
  - id: p1
    uses: tapd_probe
  - id: p2
    uses: tapd_probe
    args: { workspace_id: 42 }
`);
    const summary = await runPipeline(t, {
      registry,
      clientFactory,
      defaultArgs: { workspace_id: 39814312 },
    });
    assert.equal(summary.ok, true);
    assert.deepEqual(seen, [39814312, 42]);
  }],
];

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
