// pm 管理语义层框架公共出口（S2；S3-S6 域模板与 S7 advisor 域轴从这里取接口）
export { PM_DOMAINS, PM_OTHER_DOMAIN_LABEL, findDomain, domainLabel } from './domains.js';
export type { PmDomainMeta } from './domains.js';
export {
  PM_TEMPLATE_EXTS,
  builtinPmTemplatesDir,
  userTemplatesRoot,
  userPmTemplatesDir,
  pmAliasKey,
  splitAlias,
  discoverPmTemplates,
  mergePmEntries,
  resolvePmEntry,
  loadPmTemplate,
} from './discovery.js';
export type { PmTemplateEntry, PmCatalog } from './discovery.js';
export { groupByDomain, renderPmHelp, renderDomainHelp, renderPmList } from './render.js';
export type { PmDomainGroup } from './render.js';
export { pickLatestOpenIteration, probeDefaultIteration } from './iteration.js';
export type { ResolvedIteration, IterationProbe } from './iteration.js';
