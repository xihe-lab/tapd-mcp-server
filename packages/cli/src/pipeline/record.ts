// pipeline record：把最近执行的命令历史反序列化为 yaml 模板（PRD F8 场景 C 录制-复用闭环）
// 写/只读判定由调用方注入（命令层用 live registry + core write-policy），本模块不另造写清单。

import YAML from 'yaml';
import type { PipelineTemplate } from './types.js';
import type { HistoryEntry } from './history.js';

function slugify(tool: string, index: number): string {
  const base = tool.replace(/^tapd_/, '').replaceAll('_', '-');
  return `${base}-${index + 1}`;
}

/**
 * 历史条目 → 模板。步骤 id 取工具名去前缀 + 序号；任一步骤为写操作时模板自动声明
 * write: true（与 validate 的写标记检查一致，录制产物可直接过 validate）。
 * isWrite 必须来自 registry + resolveWrite（FSD §4.2.3 唯一判定来源）。
 */
export function buildTemplateFromHistory(
  entries: HistoryEntry[],
  meta: { name: string; title?: string },
  isWrite: (tool: string) => boolean,
): PipelineTemplate {
  const write = entries.some(e => isWrite(e.tool));
  return {
    name: meta.name,
    ...(meta.title ? { title: meta.title } : {}),
    ...(write ? { write: true } : {}),
    vars: {},
    steps: entries.map((entry, index) => ({
      id: slugify(entry.tool, index),
      uses: entry.tool,
      args: entry.args ?? {},
    })),
  };
}

export function renderTemplateYaml(template: PipelineTemplate): string {
  return YAML.stringify(template, { lineWidth: 120 });
}
