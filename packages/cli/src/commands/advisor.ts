// tapd advisor（S7 增量，TAPD 需求 1139814312001001545）：
// 在 core 轻量召回之上加「域轴 + 角色轴」——
//   域轴：查询命中知识域关键词 → 该域 `tapd pm <domain> <scenario>` 候选置顶
//         （场景清单经 pm/discovery 动态发现，templates/pm/ 无模板的域自动跳过）；
//   角色轴：--persona dev|qa|pm 同一意图按角色重排（角色进排序特征，不进命名空间）。
// 原子候选仍走 core recommend 召回，附 domain 特征字段（F9 LLM 排序预置特征）。

import type { Command } from 'commander';
import type { ToolRegistry } from '@xihe-lab/tapd-core';
import { buildAdvisorIndex } from '@xihe-lab/tapd-core';
import {
  advisorJson,
  advisorNotes,
  advise,
  parsePersona,
  renderAdvisorTable,
} from '../advisor/index.js';
import { discoverPmTemplates } from '../pm/index.js';

const DEFAULT_LIMIT = 10;

function stderr(line: string): void {
  process.stderr.write(line + '\n');
}

export function registerAdvisorCommand(program: Command, registry: ToolRegistry): void {
  const advisor = program.command('advisor').description('自然语言命令推荐（规则召回，零 LLM；命中知识域时优先 pm 场景）');
  advisor
    .argument('<query...>', '想完成的操作描述，中英文均可')
    .option('--json', '以 JSON 输出推荐结果')
    .option('--persona <role>', '按角色重排候选: dev | qa | pm（角色进排序特征，不进命名空间）')
    .action((queryParts: string[], options: { json?: boolean; persona?: string }) => {
      const query = queryParts.join(' ').trim();
      const persona = parsePersona(options.persona);
      const catalog = discoverPmTemplates();
      for (const w of catalog.warnings) stderr(`warning: ${w}`);
      const index = buildAdvisorIndex(registry);
      const result = advise(query, index, { persona, catalog, limit: DEFAULT_LIMIT });

      if (result.hits.length === 0) {
        const noTemplate =
          result.matchedDomains.length > 0
            ? `（域 ${result.matchedDomains.join(' / ')} 暂无已收录的 pm 场景模板，放置 templates/pm/<domain>-<scenario>.yaml 即自动收录）`
            : '';
        stderr(`advisor: 未找到与「${query}」相关的命令，可尝试英文关键词（如 story list、status update）${noTemplate}`);
        return;
      }
      if (options.json) {
        // stdout 保持裸数组机器可读；说明行走 stderr
        for (const note of advisorNotes(result)) stderr(note);
        process.stdout.write(advisorJson(result.hits));
        return;
      }
      process.stdout.write(renderAdvisorTable(result.hits) + '\n');
      for (const note of advisorNotes(result)) process.stdout.write(note + '\n');
    });
}
