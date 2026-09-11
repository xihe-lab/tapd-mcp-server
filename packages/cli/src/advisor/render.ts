// advisor 输出渲染（S7）：沿用现有 advisor 表格口径并扩展域/persona 说明行

import { renderTable } from '../output/table.js';
import { PERSONA_LABELS } from './persona.js';
import type { AdvisorCandidate, AdviseResult } from './recall.js';

/** 与旧版一致的 COMMAND/WRITE/DESCRIPTION 三列，新增 DOMAIN 特征列 */
export function renderAdvisorTable(hits: AdvisorCandidate[]): string {
  const rows = hits.map(hit => ({
    COMMAND: hit.command,
    WRITE: hit.write ? '✓' : '',
    DOMAIN: hit.domains.join('/'),
    DESCRIPTION: hit.description,
  }));
  return renderTable(rows, ['COMMAND', 'WRITE', 'DOMAIN', 'DESCRIPTION']);
}

/** 补充说明行：域命中情况、persona 影响一句话、pm 场景执行方式 */
export function advisorNotes(result: AdviseResult): string[] {
  const notes: string[] = [];
  if (result.matchedDomains.length > 0) {
    notes.push(
      `domain: 命中知识域 ${result.matchedDomains.join(' / ')} —— pm 场景候选置顶（未收录模板的域自动跳过）`,
    );
  }
  if (result.persona) {
    notes.push(`persona: ${result.persona} —— ${PERSONA_LABELS[result.persona]}`);
  }
  if (result.hits.some(hit => hit.kind === 'pm')) {
    notes.push('pm 场景执行: tapd pm <domain> <scenario> [--iteration <id>] [--dry-run] [--yes]');
  }
  return notes;
}

/** JSON 口径：沿用旧版裸数组（command/description/write/score/tool），扩展 kind/domains/usage */
export function advisorJson(hits: AdvisorCandidate[]): string {
  return JSON.stringify(
    hits.map(hit => ({
      ...(hit.tool !== undefined ? { tool: hit.tool } : {}),
      command: hit.command,
      description: hit.description,
      write: hit.write,
      score: hit.score,
      kind: hit.kind,
      domains: hit.domains,
      ...(hit.usage !== undefined ? { usage: hit.usage } : {}),
      ...(hit.source !== undefined ? { source: hit.source } : {}),
    })),
    null,
    2,
  ) + '\n';
}
