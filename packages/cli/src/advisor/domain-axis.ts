// advisor 域轴（S7，TAPD 需求 1139814312001001545）
//
// 软考高项第4版八知识域 × 中英文同义词关键词表（tapd-2.0.0-pm-layer-design.md §4）。
// 一张表同时服务两类候选：
//   - pm 场景模板候选：frontmatter domain 直接给域；本表负责「查询 → 域」的召回判定；
//   - 原子命令候选：对 command + description 文本扫关键词，产出的域集合作为候选的
//     domain 特征字段（F9 LLM 排序的预置特征，也用于域命中时原子块的稳定前移）。
//
// 域键口径与 pm/domains.ts 的 PM_DOMAINS 完全一致（八域；采购/绩效不单设域）。

export interface DomainKeywordEntry {
  /** 域键：tapd pm <key> <scenario> 的 <key> */
  domain: string;
  /** 域中文名（与 PM_DOMAINS.zh 同源口径） */
  zh: string;
  /** 中英文同义词；英文按词边界匹配，中文按子串匹配 */
  keywords: readonly string[];
}

export const DOMAIN_KEYWORDS: readonly DomainKeywordEntry[] = [
  // rc.2 富媒体协作（1139814312001001546/1548）：附件/图片上传下载归整合域（工具/资源整合视角）
  { domain: 'integration', zh: '整合管理', keywords: ['integration', '整合', '健康', '结项', '启动', '看板', 'attachment', '附件', 'upload', '上传', 'download', '下载', 'image', '图片', '截图'] },
  { domain: 'scope', zh: '范围管理', keywords: ['scope', 'wbs', '基线', '蔓延', '范围', '需求冻结'] },
  { domain: 'schedule', zh: '进度管理', keywords: ['schedule', '进度', '排期', '站会', '燃尽', '逾期'] },
  { domain: 'cost', zh: '成本管理', keywords: ['cost', '成本', '工时', '预算', '超支', 'evm'] },
  { domain: 'quality', zh: '质量管理', keywords: ['quality', '质量', '缺陷', '测试', '用例', '分诊'] },
  // @/提及 是沟通动作（评论 at-who 提及触达），归沟通域；'@' 为子串匹配，查询含 @ 即召回沟通域
  { domain: 'communication', zh: '沟通管理', keywords: ['communication', '沟通', '周报', '通知', '评论', 'mention', '提及', '@'] },
  { domain: 'risk', zh: '风险管理', keywords: ['risk', '风险', '预警', '登记册', '暴露'] },
  { domain: 'stakeholder', zh: '干系人管理', keywords: ['stakeholder', '干系人', '参与', '相关方'] },
];

const ASCII_KEYWORD = /^[a-z0-9]+$/;

function textContainsKeyword(lowerText: string, keyword: string): boolean {
  if (ASCII_KEYWORD.test(keyword)) {
    // 词边界匹配：cost 不误吃 process、evm 不误吃 evms
    return new RegExp(`\\b${keyword}\\b`).test(lowerText);
  }
  return lowerText.includes(keyword);
}

/** 文本命中的域键（按域表序去重）；用于原子候选的 domain 特征标注 */
export function domainsInText(text: string): string[] {
  const lower = text.toLowerCase();
  return DOMAIN_KEYWORDS.filter(entry => entry.keywords.some(k => textContainsKeyword(lower, k))).map(e => e.domain);
}

/** 查询命中域（召回入口）：空数组 = 未命中任何域轴关键词，退化为纯原子召回 */
export function matchQueryDomains(query: string): string[] {
  return domainsInText(query);
}

/** 原子候选的域特征文本：command + description（工具名段已折叠进 command，不重复扫） */
export function candidateFeatureText(command: string, description: string): string {
  return `${command} ${description}`;
}
