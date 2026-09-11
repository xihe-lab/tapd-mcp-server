// advisor 域轴/角色轴公共出口（S7）：commands/advisor.ts 只从这里取接口

export { DOMAIN_KEYWORDS, domainsInText, matchQueryDomains, candidateFeatureText } from './domain-axis.js';
export type { DomainKeywordEntry } from './domain-axis.js';
export { PERSONAS, PERSONA_LABELS, parsePersona, personaBoost } from './persona.js';
export type { Persona } from './persona.js';
export { advise } from './recall.js';
export type { AdvisorCandidate, AdviseOptions, AdviseResult } from './recall.js';
export { renderAdvisorTable, advisorNotes, advisorJson } from './render.js';
