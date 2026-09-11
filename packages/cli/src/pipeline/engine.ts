// pipeline 引擎：调度（波次并发）、写闸门、dry-run 预览、事件流
//
// 执行通道唯一性（FSD §5.1）：所有 uses 步骤一律经 toolRegistry.exec，不直接触 HTTP；
// 写/只读判定复用 core 的 write-policy（resolveWrite），本模块不自建写清单。
// 注意：pipeline 步骤的 ExecContext 不挂 onAudit —— 步骤事件走 --events 流，
// 不写命令历史（避免 pipeline record 把模板内部步骤录成新模板）。

import type { ExecContext, TapdClient, ToolRegistry } from '@xihe-lab/tapd-core';
import { resolveWrite } from '@xihe-lab/tapd-core';
import type { CliErrorCode } from '@xihe-lab/tapd-core';
import { PipelineError } from './types.js';
import type { PipelineEvent, PipelineTemplate, PlanEntry, RunSummary, StepOutcome } from './types.js';
import { evalExprStep, evalFilter, evalWhere, extractStepRefs, interpolate, interpolateForPreview } from './expression.js';

export interface RunOptions {
  registry: ToolRegistry;
  clientFactory: () => TapdClient;
  /** 最终变量表（模板 vars ← --iteration ← --input 合并后的结果） */
  vars?: Record<string, unknown>;
  /** 注入每个工具步骤的兜底参数（如全局 --workspace-id），步骤 args 显式值优先 */
  defaultArgs?: Record<string, unknown>;
  readOnly?: boolean;
  timeoutMs?: number;
  /** 显式 --dry-run（打印预览、不执行、退出码 0） */
  dryRun?: boolean;
  /** 写闸门放行标记（--yes） */
  yes?: boolean;
  /** 事件流 JSONL 输出路径 */
  eventsPath?: string;
  /** 进度输出（人类可读，走 stderr，保证 stdout 管道纯净） */
  log?: (line: string) => void;
}

interface StepNode {
  id: string;
  uses?: string;
  expr?: string;
  args: Record<string, unknown>;
  where?: string;
  filter?: string;
  deps: string[];
  write: boolean;
}

/** 依赖推导：显式 depends_on ∪ args/where/filter 中的 steps.<id> 引用 */
function buildNodes(template: PipelineTemplate, registry: ToolRegistry): StepNode[] {
  return template.steps.map(step => {
    const declared = new Set(step.depends_on ?? []);
    for (const ref of extractStepRefs(step.args ?? {})) declared.add(ref);
    if (step.where) for (const ref of extractStepRefs(step.where)) declared.add(ref);
    if (step.filter) for (const ref of extractStepRefs(step.filter)) declared.add(ref);
    const tool = step.uses ? registry.get(step.uses) : undefined;
    if (step.uses && !tool) {
      throw new PipelineError('UNKNOWN_COMMAND', `步骤 ${step.id}: 未知命令 "${step.uses}"`);
    }
    return {
      id: step.id,
      uses: step.uses,
      expr: step.expr,
      args: step.args ?? {},
      where: step.where,
      filter: step.filter,
      deps: [...declared],
      write: tool ? resolveWrite(tool) : false, // expr 步骤为本地计算，永不视为写
    };
  });
}

/** Kahn 分层：无依赖关系的步骤进入同一波次并发执行 */
export function planWaves(nodes: StepNode[]): string[][] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    for (const dep of node.deps) {
      if (!byId.has(dep)) throw new PipelineError('REF_UNKNOWN', `步骤 ${node.id} 引用了不存在的步骤 "${dep}"`);
    }
  }
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, node.deps.length);
    for (const dep of node.deps) {
      dependents.set(dep, [...(dependents.get(dep) ?? []), node.id]);
    }
  }
  const waves: string[][] = [];
  let ready = nodes.filter(n => (indegree.get(n.id) ?? 0) === 0).map(n => n.id);
  let done = 0;
  while (ready.length > 0) {
    waves.push(ready);
    done += ready.length;
    const next: string[] = [];
    for (const id of ready) {
      for (const follower of dependents.get(id) ?? []) {
        const deg = (indegree.get(follower) ?? 0) - 1;
        indegree.set(follower, deg);
        if (deg === 0) next.push(follower);
      }
    }
    ready = next;
  }
  if (done !== nodes.length) {
    const cyclic = nodes.filter(n => (indegree.get(n.id) ?? 0) > 0).map(n => n.id);
    throw new PipelineError('DEPENDENCY_CYCLE', `步骤依赖成环: ${cyclic.join(' -> ')}（检查 depends_on 与 \${steps.*} 引用）`);
  }
  return waves;
}

/** 生成执行计划（dry-run / 写闸门预览）：vars 尽力插值，步骤间引用保留原表达式 */
export function buildPreview(template: PipelineTemplate, registry: ToolRegistry, vars: Record<string, unknown>): PlanEntry[] {
  const nodes = buildNodes(template, registry);
  const waves = planWaves(nodes);
  const ctx = { vars, steps: {} };
  return waves.flatMap((wave, waveNo) =>
    wave.map(id => {
      const node = nodes.find(n => n.id === id)!;
      let args: Record<string, unknown>;
      try {
        args = interpolateForPreview(node.args, ctx) as Record<string, unknown>;
      } catch {
        args = node.args; // 预览阶段允许插值失败，保留原样展示
      }
      return {
        wave: waveNo,
        id: node.id,
        uses: node.uses,
        expr: node.expr,
        write: node.write,
        args,
        where: node.where,
        filter: node.filter,
        dependsOn: node.deps,
      };
    }),
  );
}

export function renderPreview(template: PipelineTemplate, preview: PlanEntry[], headline: string): string {
  const lines: string[] = [headline, `pipeline: ${template.name}${template.title ? ` — ${template.title}` : ''}`];
  const waves = [...new Set(preview.map(p => p.wave))].sort((a, b) => a - b);
  for (const wave of waves) {
    lines.push(`wave ${wave}（并发）`);
    for (const entry of preview.filter(p => p.wave === wave)) {
      const action = entry.uses ?? 'expr';
      const mark = entry.write ? '[write]' : '[read] ';
      lines.push(`  ${mark} ${entry.id} (${action})`);
      if (entry.dependsOn.length) lines.push(`          depends_on: ${entry.dependsOn.join(', ')}`);
      if (entry.where) lines.push(`          where: ${entry.where}`);
      if (entry.filter) lines.push(`          filter: ${entry.filter}`);
      if (Object.keys(entry.args).length > 0) {
        const json = JSON.stringify(entry.args, null, 2)
          .split('\n')
          .map((l, i) => (i === 0 ? l : `          ${l}`))
          .join('\n');
        lines.push(`          args: ${json}`);
      }
      if (entry.expr) lines.push(`          expr: ${entry.expr}`);
    }
  }
  return lines.join('\n');
}

class EventCollector {
  private lines: string[] = [];

  emit(event: PipelineEvent): void {
    this.lines.push(JSON.stringify(event));
  }

  snapshot(): string {
    return this.lines.join('\n') + '\n';
  }
}

/** registry.exec 错误码 → pipeline 错误码（退出码路由见 types.ts） */
function toPipelineError(stepId: string, code: CliErrorCode, message: string): PipelineError {
  switch (code) {
    case 'TOOL_NOT_FOUND':
      return new PipelineError('UNKNOWN_COMMAND', `步骤 ${stepId}: ${message}`);
    case 'INVALID_ARGS':
      return new PipelineError('SCHEMA_MISMATCH', `步骤 ${stepId}: 参数校验失败: ${message}`);
    default:
      return new PipelineError('STEP_FAILED', `步骤 ${stepId}: ${code}: ${message}`);
  }
}

export async function runPipeline(
  template: PipelineTemplate,
  opts: RunOptions,
  writeEvents?: (path: string, content: string) => void,
): Promise<RunSummary> {
  const start = Date.now();
  const vars = { ...template.vars, ...opts.vars };
  const nodes = buildNodes(template, opts.registry);
  const waves = planWaves(nodes);
  const log = opts.log ?? (() => undefined);

  const events = new EventCollector();
  const emitBase = { pipeline: template.name };
  const outcomes = new Map<string, StepOutcome>(
    nodes.map(n => [n.id, { id: n.id, uses: n.uses, write: n.write, status: 'pending' as const }]),
  );
  const ctx: { vars: Record<string, unknown>; steps: Record<string, { data: unknown }> } = { vars, steps: {} };

  const writeStepIds = nodes.filter(n => n.write).map(n => n.id);
  const gateBlocked = writeStepIds.length > 0 && !opts.yes;
  const dryRun = opts.dryRun === true || gateBlocked;

  // ---- 分支一：dry-run / 写闸门拦截 —— 只产计划预览，不执行任何步骤 ----
  if (dryRun) {
    const plan = buildPreview(template, opts.registry, vars);
    const headline = gateBlocked
      ? `write gate: 模板包含 ${writeStepIds.length} 个写步骤 [${writeStepIds.join(', ')}]，未检测到 --yes，拒绝落库；以下为将执行的计划预览`
      : 'dry-run: 仅打印执行计划，不实际执行';
    const now = () => new Date().toISOString();
    events.emit({ ts: now(), event: 'pipeline.dry-run', ...emitBase, ok: true, durationMs: Date.now() - start });
    for (const entry of plan) {
      events.emit({ ts: now(), event: 'step.skip', ...emitBase, step: entry.id, uses: entry.uses, write: entry.write, skipReason: 'dry-run' });
    }
    events.emit({
      ts: now(),
      event: gateBlocked ? 'pipeline.gate-blocked' : 'pipeline.end',
      ...emitBase,
      ok: !gateBlocked,
      skipReason: 'dry-run',
      durationMs: Date.now() - start,
    });
    flushEvents(events, opts, writeEvents, log);
    return {
      ok: !gateBlocked,
      pipeline: template.name,
      dryRun: true,
      gateBlocked,
      preview: plan,
      steps: [...outcomes.values()].map(o => ({ ...o, status: 'skipped', skipReason: 'dry-run' })),
      report: renderPreview(template, plan, headline),
      durationMs: Date.now() - start,
    };
  }

  // ---- 分支二：真实执行（波次内并发，波间串行）----
  const now = () => new Date().toISOString();
  events.emit({ ts: now(), event: 'pipeline.start', ...emitBase, ok: true });
  log(`pipeline ${template.name}: ${nodes.length} 步骤 / ${waves.length} 波次${writeStepIds.length > 0 ? '（含写步骤，已 --yes 确认）' : ''}`);

  let failed = false;
  for (const [waveNo, wave] of waves.entries()) {
    log(`wave ${waveNo}: ${wave.join(', ')}`);
    await Promise.all(
      wave.map(async id => {
        const node = nodes.find(n => n.id === id)!;
        const outcome = outcomes.get(id)!;

        // 上游失败/跳过 → 连锁跳过；本波次内已有兄弟失败也跳过后续启动
        const upstream = node.deps.map(d => outcomes.get(d)!).find(o => o.status !== 'ok');
        if (failed || upstream) {
          outcome.status = 'skipped';
          outcome.skipReason = failed ? 'pipeline-failed' : `upstream-${upstream?.status ?? 'pending'}`;
          events.emit({ ts: now(), event: 'step.skip', ...emitBase, step: id, uses: node.uses, write: node.write, skipReason: outcome.skipReason });
          return;
        }

        const stepStart = Date.now();
        try {
          // where 条件（求值失败按步骤失败处理，不中断其他步骤）
          if (node.where && !evalWhere(node.where, ctx)) {
            outcome.status = 'skipped';
            outcome.skipReason = 'where';
            events.emit({ ts: now(), event: 'step.skip', ...emitBase, step: id, uses: node.uses, write: node.write, skipReason: 'where' });
            log(`  ▸ ${id}: skipped (where)`);
            return;
          }

          events.emit({ ts: now(), event: 'step.start', ...emitBase, step: id, uses: node.uses, write: node.write });
          log(`  ▸ ${id} (${node.uses ?? 'expr'})...`);

          const data = node.uses ? await execToolStep(node, ctx, opts) : evalExprStep(node.expr!, ctx);
          const filtered = node.filter ? evalFilter(node.filter, data, ctx) : data;
          ctx.steps[id] = { data: filtered };
          outcome.status = 'ok';
          outcome.data = filtered;
          outcome.durationMs = Date.now() - stepStart;
          events.emit({ ts: now(), event: 'step.end', ...emitBase, step: id, uses: node.uses, write: node.write, ok: true, durationMs: outcome.durationMs });
          log(`  ✓ ${id} ${outcome.durationMs}ms`);
        } catch (error) {
          failed = true;
          outcome.status = 'failed';
          outcome.durationMs = Date.now() - stepStart;
          outcome.error =
            error instanceof PipelineError
              ? { code: error.code, message: error.message }
              : { code: 'STEP_FAILED', message: error instanceof Error ? error.message : String(error) };
          events.emit({ ts: now(), event: 'step.end', ...emitBase, step: id, uses: node.uses, write: node.write, ok: false, errorCode: outcome.error.code, durationMs: outcome.durationMs });
          log(`  ✗ ${id}: ${outcome.error.code} ${outcome.error.message}`);
        }
      }),
    );
  }

  const ok = !failed;
  const durationMs = Date.now() - start;
  events.emit({ ts: now(), event: 'pipeline.end', ...emitBase, ok, durationMs });
  flushEvents(events, opts, writeEvents, log);

  const stepList = waves.flatMap(w => w).map(id => outcomes.get(id)!);
  return {
    ok,
    pipeline: template.name,
    dryRun: false,
    gateBlocked: false,
    steps: stepList,
    report: renderReport(template, stepList, vars),
    durationMs,
  };
}

async function execToolStep(
  node: StepNode,
  ctx: { vars: Record<string, unknown>; steps: Record<string, { data: unknown }> },
  opts: RunOptions,
): Promise<unknown> {
  const tool = opts.registry.get(node.uses!)!;
  const args = interpolate(node.args, ctx) as Record<string, unknown>;
  // 兜底参数注入（全局 --workspace-id）：步骤显式声明优先
  for (const [key, value] of Object.entries(opts.defaultArgs ?? {})) {
    if (args[key] === undefined) args[key] = value;
  }
  const execCtx: ExecContext = {
    entry: 'cli',
    readOnly: opts.readOnly,
    timeoutMs: opts.timeoutMs,
  };
  const result = await opts.registry.exec(tool.name, args, execCtx, opts.clientFactory);
  if (!result.ok) {
    throw toPipelineError(node.id, result.error!.code, result.error!.message);
  }
  return result.data;
}

function flushEvents(
  events: EventCollector,
  opts: RunOptions,
  writeEvents: ((path: string, content: string) => void) | undefined,
  log: (line: string) => void,
): void {
  if (!opts.eventsPath || !writeEvents) return;
  try {
    writeEvents(opts.eventsPath, events.snapshot());
    log(`events → ${opts.eventsPath}`);
  } catch (error) {
    log(`events 写入失败 ${opts.eventsPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function renderReport(template: PipelineTemplate, steps: StepOutcome[], vars: Record<string, unknown>): string {
  const ctx = {
    vars,
    steps: Object.fromEntries(steps.filter(s => s.status === 'ok').map(s => [s.id, { data: s.data }])),
  };
  const report = template.report;
  if (report?.format === 'json') {
    return JSON.stringify(Object.fromEntries(steps.map(s => [s.id, s.data])), null, 2);
  }
  if (report?.template) {
    const body = interpolate(report.template, ctx);
    return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  }
  // 无 report 声明：输出全量运行摘要
  return steps
    .map(s => {
      const brief =
        s.status === 'ok'
          ? Array.isArray(s.data)
            ? `${s.data.length} 条`
            : 'ok'
          : s.status === 'failed'
            ? `${s.error?.code}: ${s.error?.message}`
            : `skipped (${s.skipReason})`;
      return `${s.id} (${s.uses ?? 'expr'}): ${brief}`;
    })
    .join('\n');
}
