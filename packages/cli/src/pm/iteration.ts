// 迭代缺省解析（pm 通用 --iteration 的兜底逻辑）
//
// 口径（设计 §2.1）：用户未传 --iteration 时，用一个只读步骤 tapd_get_iterations
// 取 status=open 迭代，过滤 zzz-delete-me*，按 startdate 取最新一个，把 id 注入
// vars.iteration_id。探测走 toolRegistry.exec（与 pipeline 步骤同一通道），因此可用
// mock registry 直接测试。

import type { TapdClient, ToolRegistry } from '@xihe-lab/tapd-core';

export interface ResolvedIteration {
  id: string;
  name: string;
  startdate: string;
}

export type IterationProbe =
  | { status: 'resolved'; iteration: ResolvedIteration }
  | { status: 'none' }
  | { status: 'failed'; message: string };

/** unknown 字段的安全字符串化（拒绝 [object Object]） */
function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * 从 tapd_get_iterations 的返回中选默认迭代：
 * 兼容数组与 { data: [...] } 两种包裹；过滤 zzz-delete-me*；startdate 最新优先。
 */
export function pickLatestOpenIteration(rows: unknown): ResolvedIteration | undefined {
  const list = Array.isArray(rows) ? rows : ((rows as { data?: unknown } | null)?.data ?? undefined);
  if (!Array.isArray(list)) return undefined;
  const cleaned = list.filter((row): row is Record<string, unknown> => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    return !toStr((row as Record<string, unknown>).name).startsWith('zzz-delete-me');
  });
  if (cleaned.length === 0) return undefined;
  const sorted = [...cleaned].sort((a, b) => toStr(b.startdate).localeCompare(toStr(a.startdate)));
  const top = sorted[0];
  return { id: toStr(top.id), name: toStr(top.name), startdate: toStr(top.startdate) };
}

/** 只读探测默认迭代；探测失败不抛错（部分场景不依赖迭代），由调用方决定提示与降级 */
export async function probeDefaultIteration(
  registry: ToolRegistry,
  clientFactory: () => TapdClient,
  opts: { defaultArgs?: Record<string, unknown>; timeoutMs?: number } = {},
): Promise<IterationProbe> {
  let result;
  try {
    result = await registry.exec(
      'tapd_get_iterations',
      { status: 'open', fields: 'id,name,startdate,status', ...(opts.defaultArgs ?? {}) },
      { entry: 'cli', timeoutMs: opts.timeoutMs },
      clientFactory,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'failed', message };
  }
  if (!result.ok) {
    return { status: 'failed', message: `${result.error?.code}: ${result.error?.message}` };
  }
  const picked = pickLatestOpenIteration(result.data);
  return picked ? { status: 'resolved', iteration: picked } : { status: 'none' };
}
