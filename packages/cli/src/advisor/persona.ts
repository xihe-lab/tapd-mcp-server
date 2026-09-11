// advisor 角色轴 --persona（S7 / 设计 §2.2 persona 通道）
//
// 四层分工里的「意图路由按角色分」：角色进排序特征，不进命名空间——同一查询在
// dev/qa/pm 三档下重排候选；未给 --persona 时维持现有排序（行为零变化）。

import { CliError } from '../errors.js';

export type Persona = 'dev' | 'qa' | 'pm';

export const PERSONAS: readonly Persona[] = ['dev', 'qa', 'pm'];

/** 输出里的一行角色影响说明（中文，说明偏移方向而非实现细节） */
export const PERSONA_LABELS: Record<Persona, string> = {
  dev: '开发视角：task/story/branch 类命令优先',
  qa: '测试视角：bug/test-case/test-plan 类命令优先',
  pm: 'PM 视角：pm 场景与 iteration/release/report 类命令优先',
};

// pm 角色对 pm 场景候选全量加权（kind 判定），对原子候选按资源词匹配
const PERSONA_ATOMIC_PATTERNS: Record<Exclude<Persona, 'pm'>, RegExp> = {
  dev: /\b(task|story|branch)\b/,
  qa: /\b(bug|test-case|test-plan|test)\b/,
};

/** 候选是否命中角色偏好（参与重排的 +2 权重判定） */
export function personaBoost(candidate: { kind: 'pm' | 'atomic'; command: string }, persona: Persona): boolean {
  if (persona === 'pm') {
    return candidate.kind === 'pm' || /\b(iteration|release|report)\b/.test(candidate.command);
  }
  return PERSONA_ATOMIC_PATTERNS[persona].test(candidate.command);
}

/** 解析 --persona：未给返回 undefined；未知值报 INVALID_ARGS（exit 2） */
export function parsePersona(raw: string | undefined): Persona | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim().toLowerCase();
  if ((PERSONAS as readonly string[]).includes(value)) return value as Persona;
  throw new CliError('INVALID_ARGS', `未知 persona "${raw}"，可选: ${PERSONAS.join('|')}（角色进排序特征，不进命名空间）`);
}
