// 表达式求值：模板插值（${...}）与 where/filter 布尔表达式
//
// 语法约定（对齐 pm-layer-design.md §3 示例）：
//   插值     "前缀 ${vars.iteration_id} 后缀" —— 整串仅一个 ${...} 时保留原生类型
//   过滤器   ${steps.stories.data | length}、| json、| join ', '
//   where    "steps.bugs.data.length > 0"（裸表达式，布尔上下文）
//   filter   "!item.name.startsWith('zzz-delete-me')"（逐项，上下文含 item/index/vars/today）
//
// 实现说明：where/filter 使用 node:vm 在独立上下文中求值（带超时）。模板与 CLI
// 配置同属本地用户文件信任级，vm 在此承担的是「隔离求值 + 超时保护」而非安全边界。

import vm from 'node:vm';
import { PipelineError } from './types.js';

export interface ExprContext {
  vars: Record<string, unknown>;
  steps: Record<string, { data: unknown }>;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const REF_PATTERN = /\$\{([^}]+)\}/g;
const STEP_REF_PATTERN = /\bsteps\.([A-Za-z0-9_-]+)/g;

/** 整串恰为一个含 steps.<id> 的 ${...} 引用（运行期才有真值；校验跳过、预览保留原样） */
export function isDeferredStepRef(value: unknown): value is string {
  return typeof value === 'string' && /^\s*\$\{[^}]*steps\.[^}]*\}\s*$/.test(value);
}

/** 整串恰为任意 ${...} 引用（含 vars）：静态校验期真值未知，类型检查跳过 */
export function isDeferredWholeRef(value: unknown): value is string {
  return typeof value === 'string' && /^\s*\$\{[^}]+\}\s*$/.test(value);
}

/** 从任意值中提取 ${steps.<id>} / where|filter 里的 steps.<id> 引用（用于依赖推导与校验） */
export function extractStepRefs(value: unknown): string[] {
  const found = new Set<string>();
  const scan = (v: unknown): void => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(REF_PATTERN)) collect(m[1]);
      for (const m of v.matchAll(STEP_REF_PATTERN)) found.add(m[1]);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(scan);
      return;
    }
    if (v !== null && typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(scan);
    }
  };
  const collect = (expr: string): void => {
    for (const m of expr.matchAll(STEP_REF_PATTERN)) found.add(m[1]);
  };
  scan(value);
  return [...found];
}

function walk(root: unknown, segments: string[]): unknown {
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      if (Number.isNaN(idx)) return undefined;
      cur = cur[idx];
      continue;
    }
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function scalarize(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return JSON.stringify(v);
}

function applyFilter(spec: string, value: unknown): unknown {
  const [name, argRaw] = spec.split(/[:\s]+/, 2).map(s => s?.trim());
  const arg = argRaw?.replace(/^['"]|['"]$/g, '');
  switch (name) {
    case 'length':
    case 'count':
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'string') return value.length;
      if (value !== null && typeof value === 'object') return Object.keys(value).length;
      return 0;
    case 'json':
      return JSON.stringify(value, null, 2);
    case 'join':
      return Array.isArray(value) ? value.map(scalarize).join(arg ?? ',') : value;
    case 'keys':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value)
        : value;
    case 'rows': {
      // 对象数组 → markdown 表格行：| v1 | v2 | ...（字段清单经 arg 传入，如 rows id,name）
      if (!Array.isArray(value)) return value;
      const fields = (arg ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      return value
        .map(item => {
          const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
          const cells = fields.map(f => scalarize(record[f]).replaceAll('|', '\\|').replaceAll('\n', ' '));
          return `| ${cells.join(' | ')} |`;
        })
        .join('\n');
    }
    default:
      throw new PipelineError('EXPR_ERROR', `未知的过滤器 "| ${name}"（支持 length/count/json/join/keys/rows）`);
  }
}

/** 求值单个引用表达式（不含 ${} 包装），如 `vars.iteration_id` 或 `steps.s.data | length` */
export function evalRef(expr: string, ctx: ExprContext): unknown {
  const [pathSpec, ...filterSpecs] = expr.split('|').map(s => s.trim());
  const segments = pathSpec.split('.').filter(Boolean);
  const head = segments[0];
  if (head !== 'vars' && head !== 'steps') {
    throw new PipelineError('EXPR_ERROR', `插值表达式必须以 vars. 或 steps. 开头: "\${${expr}}"`);
  }
  let value = walk(head === 'vars' ? ctx.vars : ctx.steps, segments.slice(1));
  for (const f of filterSpecs) {
    if (f) value = applyFilter(f, value);
  }
  return value;
}

/** 表达式语法编译检查（不执行），供 validate 使用 */
export function checkExprSyntax(expr: string, wrapped: boolean): void {
  const source = wrapped ? `(${expr})` : expr;
  try {
    new vm.Script(source, { filename: 'pipeline-expr' });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new PipelineError('EXPR_ERROR', `表达式语法错误: ${message}`);
  }
}

function sandbox(ctx: ExprContext, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vars: ctx.vars,
    steps: ctx.steps,
    today: today(),
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    ...extra,
  };
}

/** 求值 where 布尔表达式（上下文：vars/steps/today） */
export function evalWhere(expr: string, ctx: ExprContext): boolean {
  try {
    const result = vm.runInNewContext(`(${expr})`, sandbox(ctx), { timeout: 200 });
    return Boolean(result);
  } catch (error) {
    if (error instanceof PipelineError) throw error;
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new PipelineError('EXPR_ERROR', `where 表达式求值失败: ${message}`);
  }
}

/** 对数组结果的每一项求值 filter（上下文：item/index/vars/today） */
export function evalFilter(expr: string, data: unknown, ctx: ExprContext): unknown {
  if (!Array.isArray(data)) return data;
  const kept = data.filter((item, index) => {
    try {
      return Boolean(vm.runInNewContext(`(${expr})`, sandbox(ctx, { item, index }), { timeout: 200 }));
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      throw new PipelineError('EXPR_ERROR', `filter 表达式求值失败(step item #${index}): ${message}`);
    }
  });
  return kept;
}

/** 求值 expr 步骤（本地计算，不触 API；上下文：vars/steps/today） */
export function evalExprStep(expr: string, ctx: ExprContext): unknown {
  try {
    return vm.runInNewContext(`(${expr})`, sandbox(ctx), { timeout: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new PipelineError('EXPR_ERROR', `expr 步骤求值失败: ${message}`);
  }
}

/**
 * 对模板值做 ${...} 插值（深遍历对象/数组）。
 * 整串恰好是一个 ${...} 时返回原生类型值；其余按字符串拼接（对象/数组经 JSON 序列化）。
 */
export function interpolate(value: unknown, ctx: ExprContext): unknown {
  if (typeof value === 'string') return interpolateString(value, ctx);
  if (Array.isArray(value)) return value.map(v => interpolate(v, ctx));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolate(v, ctx);
    }
    return out;
  }
  return value;
}

function stringifyEmbedded(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

const WHOLE_REF = /^\$\{([^}]+)\}$/;

function interpolateString(text: string, ctx: ExprContext): unknown {
  const whole = WHOLE_REF.exec(text);
  if (whole) return evalRef(whole[1].trim(), ctx);
  return text.replace(REF_PATTERN, (_match, expr: string) => stringifyEmbedded(evalRef(expr.trim(), ctx)));
}

/** 预览专用插值：vars 正常解析，步骤间引用（运行期才有真值）保留原表达式展示（含嵌入式） */
export function interpolateForPreview(value: unknown, ctx: ExprContext): unknown {
  if (isDeferredStepRef(value)) return value;
  if (typeof value === 'string') {
    return value.replace(REF_PATTERN, (match, expr: string) =>
      expr.includes('steps.') ? match : stringifyEmbedded(evalRef(expr.trim(), ctx)));
  }
  if (Array.isArray(value)) return value.map(v => interpolateForPreview(v, ctx));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateForPreview(v, ctx);
    }
    return out;
  }
  return value;
}
