// pm 域元数据表（S2 框架所有，硬编码）
// 软考高项第4版知识域 → pm 命令域键。采购（第16章）场景过弱不设域、绩效监控（第18章）
// 由 integration/cost/quality 组合覆盖 —— 口径来源 tapd-2.0.0-pm-layer-design.md §2。
//
// 本表只描述「域」本身；场景清单由模板发现动态渲染（S3-S6 往 templates/pm/ 丢 yaml 即被
// 收录，无需改本文件或任何注册代码）。

export interface PmDomainMeta {
  /** 命令域键：tapd pm <key> <scenario> */
  key: string;
  /** 域中文名 */
  zh: string;
  /** 高项第4版章节号 */
  chapter: string;
}

export const PM_DOMAINS: readonly PmDomainMeta[] = [
  { key: 'integration', zh: '整合管理', chapter: '第8章' },
  { key: 'scope', zh: '范围管理', chapter: '第9章' },
  { key: 'schedule', zh: '进度管理', chapter: '第10章' },
  { key: 'cost', zh: '成本管理', chapter: '第11章' },
  { key: 'quality', zh: '质量管理', chapter: '第12章' },
  { key: 'communication', zh: '沟通管理', chapter: '第14章' },
  { key: 'risk', zh: '风险管理', chapter: '第15章' },
  { key: 'stakeholder', zh: '干系人管理', chapter: '第17章' },
];

/** frontmatter domain 不在域表中的模板在 help 分组里归入的组 */
export const PM_OTHER_DOMAIN_LABEL = '其他';

export function findDomain(key: string): PmDomainMeta | undefined {
  return PM_DOMAINS.find(d => d.key === key);
}

/** '风险管理（第15章）'；未知域返回分组名「其他」 */
export function domainLabel(key: string): string {
  const d = findDomain(key);
  return d ? `${d.zh}（${d.chapter}）` : PM_OTHER_DOMAIN_LABEL;
}
