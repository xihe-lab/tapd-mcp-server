// pm help / list 渲染：分组由「模板 × 域表」动态合成（设计 §2 / 验收 1）
// 域表见 domains.ts；场景清单来自 discovery —— 后续波次只往 templates/pm/ 丢 yaml，
// 分组与场景列表自动更新，零注册代码。

import { PM_DOMAINS, PM_OTHER_DOMAIN_LABEL, domainLabel, findDomain } from './domains.js';
import { userPmTemplatesDir, type PmCatalog, type PmTemplateEntry } from './discovery.js';

export interface PmDomainGroup {
  /** 域键；「其他」组为空串 */
  key: string;
  label: string;
  known: boolean;
  entries: PmTemplateEntry[];
}

/** 按域表序分组；未知 domain 归「其他」（置于最后） */
export function groupByDomain(entries: PmTemplateEntry[]): PmDomainGroup[] {
  const groups: PmDomainGroup[] = PM_DOMAINS.map(d => ({
    key: d.key,
    label: `${d.zh}（${d.chapter}）`,
    known: true,
    entries: [],
  }));
  const other: PmDomainGroup = { key: '', label: PM_OTHER_DOMAIN_LABEL, known: false, entries: [] };
  for (const e of entries) {
    const meta = findDomain(e.domain);
    (meta ? groups.find(g => g.key === e.domain)! : other).entries.push(e);
  }
  return [...groups, other];
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function scenarioLine(prefix: string, entry: PmTemplateEntry): string {
  const mark = entry.write ? '[write]' : '[read] ';
  const title = entry.title ? `${entry.title} ` : '';
  const userTag = entry.source === 'user' ? ' （用户覆盖）' : '';
  return `${prefix}${pad(entry.scenario, 18)}${title}${mark}${userTag}`;
}

/** `tapd pm --help` 的域分组块（commander addHelpText('after') 用） */
export function renderPmHelp(catalog: PmCatalog): string {
  const lines: string[] = [
    '管理语义层（软考高项第4版知识域）：每个场景 = 一份 pipeline 模板的语义别名',
    '  tapd pm <domain> <scenario>  ≡  tapd pipeline run templates/pm/<domain>-<scenario>.yaml',
    '',
    '域分组:',
  ];
  for (const g of groupByDomain(catalog.entries)) {
    lines.push(`  ${pad(g.key || 'other', 14)}${g.label}`);
    if (g.entries.length === 0) {
      lines.push(`      （暂无场景模板——放置 templates/pm/<domain>-<scenario>.yaml 即自动收录）`);
      continue;
    }
    for (const e of g.entries) {
      // 「其他」组带域前缀，方便定位是哪个自定义域
      const prefix = g.known ? '      ' : `      ${e.domain || '无域'}/`;
      lines.push(scenarioLine(prefix, e));
    }
  }
  lines.push(
    '',
    '通用 flags:',
    '  --iteration <id>  迭代作用域（缺省自动取最新 open 迭代，过滤 zzz-delete-me*）',
    '  --input <json>    模板变量注入（JSON 对象），如 --input \'{"owner":"xu"}\'',
    '  --dry-run         只打印执行计划预览，不执行任何步骤',
    '  --yes             确认执行写步骤（含写步骤的场景缺省 dry-run 闸门拒绝落库）',
    '',
    `用户模板目录: ${userPmTemplatesDir()}（同名覆盖内置；tapd pm list 查看清单）`,
  );
  return lines.join('\n');
}

/** `tapd pm <domain> --help` 的场景清单块 */
export function renderDomainHelp(domainKey: string, catalog: PmCatalog): string {
  const meta = findDomain(domainKey);
  const head = meta ? `${domainKey} ${domainLabel(domainKey)}` : `${domainKey}（自定义域）`;
  const lines: string[] = [`${head} 场景:`];
  const inDomain = catalog.entries.filter(e => e.domain === domainKey);
  if (inDomain.length === 0) {
    lines.push('  （暂无场景模板——放置 templates/pm/<domain>-<scenario>.yaml 即自动收录）');
  }
  for (const e of inDomain) lines.push(scenarioLine('  ', e));
  lines.push(`用法: tapd pm ${domainKey} <scenario> [--iteration <id>] [--dry-run] [--yes]`);
  return lines.join('\n');
}

/** `tapd pm list` 明细行（域 / 场景 / 是否写 / 来源 / 标题） */
export function renderPmList(entries: PmTemplateEntry[]): string {
  if (entries.length === 0) {
    return `（暂无 pm 场景模板——放置 ${userPmTemplatesDir()}/ 或随包 templates/pm/ 即自动收录）`;
  }
  const domainWidth = Math.max('domain'.length, ...entries.map(e => e.domain.length));
  const scenarioWidth = Math.max('scenario'.length, ...entries.map(e => e.scenario.length));
  const lines = [
    `${pad('domain', domainWidth)}  ${pad('scenario', scenarioWidth)}  mode   source   title`,
  ];
  for (const e of entries) {
    lines.push(
      `${pad(e.domain, domainWidth)}  ${pad(e.scenario, scenarioWidth)}  ${e.write ? 'write' : 'read '}  ${pad(e.source, 6)}  ${e.title}${e.source === 'user' ? ' （用户覆盖内置）' : ''}`,
    );
  }
  return lines.join('\n');
}
