// 模板加载：yaml/json 解析、结构校验、内置模板解析（裸名 / templates/ 相对名 / 绝对路径）

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { PipelineError, type PipelineTemplate } from './types.js';

/** 内置模板目录：dist/commands → packages/cli/templates（src 同深度，tsx 下同样成立） */
export function builtinTemplatesDir(): string {
  return fileURLToPath(new URL('../../templates/', import.meta.url));
}

const stepSchema = z
  .object({
    id: z.string().min(1),
    uses: z.string().min(1).optional(),
    expr: z.string().min(1).optional(),
    args: z.record(z.unknown()).optional(),
    where: z.string().optional(),
    filter: z.string().optional(),
    depends_on: z.array(z.string()).optional(),
  })
  .strict()
  .refine(step => Boolean(step.uses) !== Boolean(step.expr), {
    message: '步骤必须且只能声明 uses（工具步骤）或 expr（本地表达式步骤）之一',
  });

const templateSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().optional(),
    write: z.boolean().optional(),
    domain: z.string().optional(),
    unwrap: z.boolean().optional(),
    vars: z.record(z.unknown()).optional(),
    steps: z.array(stepSchema).min(1, { message: 'steps 不能为空' }),
    report: z
      .object({
        format: z.enum(['markdown', 'text', 'json']).optional(),
        template: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function parseTemplate(source: string, label: string): PipelineTemplate {
  let raw: unknown;
  try {
    raw = YAML.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new PipelineError('TEMPLATE_INVALID', `模板解析失败（${label}）: ${message}`);
  }
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new PipelineError('TEMPLATE_INVALID', `模板结构不合法（${label}）`, issues);
  }
  const doc: PipelineTemplate = parsed.data;
  const ids = new Set<string>();
  for (const step of doc.steps) {
    if (ids.has(step.id)) {
      throw new PipelineError('TEMPLATE_INVALID', `模板结构不合法（${label}）`, [`步骤 id 重复: ${step.id}`]);
    }
    ids.add(step.id);
  }
  for (const step of doc.steps) {
    for (const dep of step.depends_on ?? []) {
      if (!ids.has(dep)) {
        throw new PipelineError('TEMPLATE_INVALID', `模板结构不合法（${label}）`, [
          `steps.${step.id}.depends_on 引用了不存在的步骤: ${dep}`,
        ]);
      }
    }
  }
  return doc;
}

const TEMPLATE_EXTS = ['.yaml', '.yml', '.json'];

/**
 * 解析模板位置：
 *   1. 裸名（iteration-review）→ 内置模板目录
 *   2. 相对/绝对路径（templates/pm/risk-scan.yaml）→ 相对 cwd；不存在时回退内置目录
 *      （cwd 形如 "templates/xxx.yaml" 时，内置目录侧自动剥掉 templates/ 前缀再试）
 * 内置目录命中支持缺省扩展名。
 */
export function resolveTemplatePath(ref: string): string {
  const looksLikePath = ref.includes('/') || ref.includes('\\') || TEMPLATE_EXTS.includes(path.extname(ref));
  const candidates: string[] = [];
  if (looksLikePath) {
    candidates.push(path.isAbsolute(ref) ? ref : path.resolve(process.cwd(), ref));
    const normalized = ref.replace(/^[\\/]+/, '').replace(/^templates[\\/]/, '');
    for (const ext of TEMPLATE_EXTS) {
      candidates.push(path.resolve(builtinTemplatesDir(), `${normalized.replace(/\.(yaml|yml|json)$/, '')}${ext}`));
    }
  } else {
    for (const ext of TEMPLATE_EXTS) {
      candidates.push(path.resolve(builtinTemplatesDir(), `${ref}${ext}`));
    }
  }
  const hit = candidates.find(c => existsSync(c) && statSync(c).isFile());
  if (!hit) {
    throw new PipelineError('IO', `找不到模板: ${ref}（已尝试 ${candidates.join(', ')}）`);
  }
  return hit;
}

export function loadTemplate(ref: string): { template: PipelineTemplate; path: string } {
  const file = resolveTemplatePath(ref);
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PipelineError('IO', `读取模板失败（${file}）: ${message}`);
  }
  return { template: parseTemplate(source, file), path: file };
}

/** 内置模板清单（tapd pipeline list / 后续 pm 层复用） */
export function listBuiltinTemplates(): { name: string; title: string; write: boolean; file: string }[] {
  const dir = builtinTemplatesDir();
  let entries: string[];
  try {
    entries = readdirSync(dir).filter(f => TEMPLATE_EXTS.includes(path.extname(f))).sort();
  } catch {
    return []; // 目录不存在（如被裁剪的安装），按空清单处理
  }
  return entries.map(file => {
    const full = path.join(dir, file);
    const tpl = parseTemplate(readFileSync(full, 'utf8'), full);
    return { name: tpl.name, title: tpl.title ?? '', write: Boolean(tpl.write), file };
  });
}
