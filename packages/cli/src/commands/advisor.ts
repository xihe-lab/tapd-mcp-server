import type { Command } from 'commander';
import type { ToolRegistry } from '@xihe-lab/tapd-core';
import { buildAdvisorIndex, recommend } from '@xihe-lab/tapd-core';
import { renderTable } from '../output/table.js';

const DEFAULT_LIMIT = 10;

export function registerAdvisorCommand(program: Command, registry: ToolRegistry): void {
  const advisor = program.command('advisor').description('自然语言命令推荐（规则召回，零 LLM）');
  advisor
    .argument('<query...>', '想完成的操作描述，中英文均可')
    .option('--json', '以 JSON 输出推荐结果')
    .action((queryParts: string[], options: { json?: boolean }) => {
      const query = queryParts.join(' ').trim();
      const index = buildAdvisorIndex(registry);
      const hits = recommend(query, index, DEFAULT_LIMIT);
      if (hits.length === 0) {
        process.stderr.write(`advisor: 未找到与「${query}」相关的命令，可尝试英文关键词（如 story list、status update）\n`);
        return;
      }
      if (options.json) {
        process.stdout.write(JSON.stringify(hits, null, 2) + '\n');
        return;
      }
      const rows = hits.map(hit => ({
        COMMAND: hit.command,
        WRITE: hit.write ? '✓' : '',
        DESCRIPTION: hit.description,
      }));
      process.stdout.write(renderTable(rows, ['COMMAND', 'WRITE', 'DESCRIPTION']) + '\n');
    });
}
