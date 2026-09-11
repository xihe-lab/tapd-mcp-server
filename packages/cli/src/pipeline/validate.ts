// 静态校验（tapd pipeline validate）：命令存在性、参数 zod 校验、写步骤标记、表达式语法、引用完整性
//
// 校验口径：
//   - 参数校验逐字段进行：值仍为 ${steps.*} 延迟引用时跳过该字段的类型检查（运行期类型未知），
//     其余字段对 schema 逐个 safeParse，避免整对象 parse 被延迟引用误伤。
//   - 写/只读判定复用 core 的 write-policy（resolveWrite），不另造清单（FSD §4.2.3）。

import type { ToolDef, ToolRegistry } from '@xihe-lab/tapd-core';
import { resolveWrite } from '@xihe-lab/tapd-core';
import { z } from 'zod';
import type { PipelineStep, PipelineTemplate } from './types.js';
import { PipelineError } from './types.js';
import { checkExprSyntax, extractStepRefs, interpolate, isDeferredWholeRef } from './expression.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  target: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** 每步骤的写判定（供预览/运行复用） */
  writeSteps: string[];
}

function unwrapSchema(field: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = field;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable || cur instanceof z.ZodDefault) {
      cur = cur._def.innerType;
    } else {
      return cur;
    }
  }
}

function validateStepArgs(step: PipelineStep, tool: ToolDef, issues: ValidationIssue[]): void {
  const schema = tool.inputSchema;
  const shape: Record<string, z.ZodTypeAny> =
    schema instanceof z.ZodObject ? (schema.shape as Record<string, z.ZodTypeAny>) : {};
  const args = step.args ?? {};

  // 必填缺失：schema 声明 required（非 optional/nullable/default）而步骤未提供
  for (const [key, field] of Object.entries(shape)) {
    if (key in args) continue;
    if (!field.isOptional()) {
      issues.push({ level: 'error', target: `steps.${step.id}.args.${key}`, message: '必填参数缺失（schema required）' });
    }
  }

  for (const key of Object.keys(args)) {
    const field = shape[key];
    if (!field) {
      issues.push({ level: 'error', target: `steps.${step.id}.args.${key}`, message: `工具 ${tool.name} 的 schema 不包含参数 "${key}"（运行期会被丢弃，疑似拼写错误）` });
      continue;
    }
    // 整串 ${...}（vars/steps 引用）运行期才有真值：静态跳过类型检查，仅查 key 合法性
    if (isDeferredWholeRef(args[key])) continue;
    const inner = unwrapSchema(field);
    const probe = inner.safeParse(interpolate(args[key], { vars: {}, steps: {} }));
    if (!probe.success) {
      const detail = probe.error.issues.map(i => i.message).join('; ');
      issues.push({ level: 'error', target: `steps.${step.id}.args.${key}`, message: `参数不符 schema: ${detail}` });
    }
  }
}

export function validateTemplate(template: PipelineTemplate, registry: ToolRegistry): ValidationResult {
  const issues: ValidationIssue[] = [];
  const writeSteps: string[] = [];
  const stepIds = new Set(template.steps.map(s => s.id));

  for (const step of template.steps) {
    // 1) 依赖与引用完整性（depends_on 指向缺失步骤已由 parseTemplate 拦截，此处查 ${steps.*} 软引用）
    const refs = [
      ...extractStepRefs(step.args ?? {}),
      ...extractStepRefs(step.depends_on ?? []),
      ...(step.where ? extractStepRefs(step.where) : []),
      ...(step.filter ? extractStepRefs(step.filter) : []),
    ];
    for (const ref of refs) {
      if (!stepIds.has(ref)) {
        issues.push({ level: 'error', target: `steps.${step.id}`, message: `引用了不存在的步骤 "${ref}"` });
      }
    }

    // 2) 表达式语法
    try {
      if (step.expr) checkExprSyntax(step.expr, true);
      if (step.where) checkExprSyntax(step.where, true);
      if (step.filter) checkExprSyntax(step.filter, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({ level: 'error', target: `steps.${step.id}`, message });
    }

    // 3) expr 步骤：本地计算，无命令校验
    if (step.expr && !step.uses) continue;

    // 4) 命令存在性（uses 必须命中 toolRegistry）
    const tool = step.uses ? registry.get(step.uses) : undefined;
    if (!tool) {
      issues.push({
        level: 'error',
        target: `steps.${step.id}.uses`,
        message: `未知命令 "${step.uses}"（必须是 toolRegistry 中存在的工具名，可用 tapd advisor 或 schema 导出查询）`,
      });
      continue;
    }

    // 5) 写判定（复用 write-policy）与参数 schema 校验
    if (resolveWrite(tool)) writeSteps.push(step.id);
    try {
      validateStepArgs(step, tool, issues);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({ level: 'error', target: `steps.${step.id}.args`, message });
    }
  }

  // 6) 写标记一致性：含写步骤必须声明 write: true（闸门依据，防绕过）
  if (writeSteps.length > 0 && template.write !== true) {
    issues.push({
      level: 'error',
      target: 'write',
      message: `模板包含写步骤 [${writeSteps.join(', ')}]，必须声明 write: true（运行期将强制写闸门）`,
    });
  } else if (writeSteps.length === 0 && template.write === true) {
    issues.push({
      level: 'warning',
      target: 'write',
      message: '模板声明 write: true 但所有步骤均为只读，建议改为 write: false',
    });
  }

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');
  return { ok: errors.length === 0, errors, warnings, writeSteps };
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map(i => `  ${i.level === 'error' ? '✗' : '!'} ${i.target}: ${i.message}`).join('\n');
}

export function assertTemplateValid(template: PipelineTemplate, registry: ToolRegistry): ValidationResult {
  const result = validateTemplate(template, registry);
  if (!result.ok) {
    throw new PipelineError(
      'TEMPLATE_INVALID',
      `模板校验未通过（${template.name}）`,
      result.errors.map(e => `${e.target}: ${e.message}`),
    );
  }
  return result;
}
