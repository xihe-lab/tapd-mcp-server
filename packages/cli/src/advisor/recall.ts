// advisor 域轴召回 + 角色重排（S7 本体）
//
// 召回优先级（设计 §4 / 验收 5）：
//   1. 查询命中域关键词 → 该域的 `tapd pm <domain> <scenario>` 候选置顶
//      （场景清单从 pm/discovery 动态取，模板未收录的域自动跳过，不报错）；
//   2. 原子命令候选沿用 core advisor 召回逻辑（recommend），每条附 domain 特征；
//      域命中的原子候选在原子块内稳定前移（domain 作为排序特征的预演，F9 完整版再深化）。
//   3. --persona 在上述基础上按角色加权重排；无 persona 时维持现有排序。
//
// 权重合成：boost = 域命中(pm 场景 +2 / 原子 +1) + persona 命中(+2)，同为稳定键，
// boost 同分按池内序（pm 池在前、原子池按 recommend 顺序）——保证确定性输出。

import type { AdvisorEntry, AdvisorHit } from '@xihe-lab/tapd-core';
import { recommend } from '@xihe-lab/tapd-core';
import { domainLabel } from '../pm/index.js';
import { discoverPmTemplates, type PmCatalog, type PmTemplateEntry } from '../pm/index.js';
import { candidateFeatureText, domainsInText, matchQueryDomains } from './domain-axis.js';
import { personaBoost, type Persona } from './persona.js';

const DEFAULT_LIMIT = 10;
/** 原子召回池放大系数：给 persona/域重排留出上浮空间，最终仍截断到 limit */
const POOL_FACTOR = 4;
const MIN_POOL = 40;

export interface AdvisorCandidate {
  /** 原子命令 '<resource> <action>'；pm 场景为 'pm <domain> <scenario>' */
  command: string;
  description: string;
  write: boolean;
  /** core 召回分（仅原子候选有含义；pm 场景候选为规则置顶，固定 0） */
  score: number;
  /** 域特征：pm 场景为 [frontmatter domain]；原子候选来自关键词扫描，可多域；无命中为 [] */
  domains: string[];
  kind: 'pm' | 'atomic';
  /** 原子候选对应的底层工具名（pm 场景无） */
  tool?: string;
  /** pm 场景候选附执行方式提示 */
  usage?: string;
  /** pm 模板来源（builtin/用户覆盖） */
  source?: 'builtin' | 'user';
}

export interface AdviseOptions {
  persona?: Persona;
  limit?: number;
  /** 注入 pm 目录（测试/复用）；缺省 discoverPmTemplates() 动态发现 */
  catalog?: PmCatalog;
}

export interface AdviseResult {
  hits: AdvisorCandidate[];
  /** 查询命中的域键（按域表序）；空 = 未命中域轴 */
  matchedDomains: string[];
  persona?: Persona;
}

function pmCandidate(entry: PmTemplateEntry): AdvisorCandidate {
  return {
    command: `pm ${entry.domain} ${entry.scenario}`,
    description: entry.title || `${domainLabel(entry.domain)}场景`,
    write: entry.write,
    score: 0,
    domains: [entry.domain],
    kind: 'pm',
    usage: `tapd pm ${entry.domain} ${entry.scenario} [--iteration <id>] [--dry-run]${entry.write ? ' [--yes]' : ''}`,
    source: entry.source,
  };
}

function atomicCandidate(hit: AdvisorHit): AdvisorCandidate {
  return {
    command: hit.command,
    description: hit.description,
    write: hit.write,
    score: hit.score,
    domains: domainsInText(candidateFeatureText(hit.command, hit.description)),
    kind: 'atomic',
    tool: hit.tool,
  };
}

/**
 * 域轴召回 + persona 重排。
 * 返回截断到 limit 的候选；matchedDomains 供输出层说明域命中情况。
 */
export function advise(query: string, index: AdvisorEntry[], options: AdviseOptions = {}): AdviseResult {
  const persona = options.persona;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const matchedDomains = matchQueryDomains(query);

  // ---- pm 场景池：域命中取命中域；未命中域时仅 pm 角色注入全量场景（否则不入池） ----
  const catalog = options.catalog ?? discoverPmTemplates();
  let pmEntries: PmTemplateEntry[];
  if (matchedDomains.length > 0) {
    const orderOf = new Map(matchedDomains.map((d, i) => [d, i]));
    pmEntries = catalog.entries
      .filter(e => orderOf.has(e.domain))
      .sort((a, b) => (orderOf.get(a.domain)! - orderOf.get(b.domain)!) || a.scenario.localeCompare(b.scenario));
  } else if (persona === 'pm') {
    pmEntries = catalog.entries;
  } else {
    pmEntries = [];
  }

  // ---- 原子池：现有 recommend 召回逻辑，池放大后参与统一重排 ----
  const poolLimit = Math.max(limit * POOL_FACTOR, MIN_POOL);
  const atomicHits = recommend(query, index, poolLimit);

  const pmCandidates = pmEntries.map(pmCandidate);
  const atomicCandidates = atomicHits.map(atomicCandidate);
  const pmCount = pmCandidates.length;

  const scored = [
    ...pmCandidates.map((candidate, i) => ({ candidate, base: i })),
    ...atomicCandidates.map((candidate, j) => ({ candidate, base: pmCount + j })),
  ].map(({ candidate, base }) => {
    let boost = 0;
    if (candidate.kind === 'pm') {
      if (matchedDomains.includes(candidate.domains[0] ?? '')) boost += 2;
    } else if (candidate.domains.some(d => matchedDomains.includes(d))) {
      boost += 1;
    }
    if (persona && personaBoost(candidate, persona)) boost += 2;
    return { candidate, base, boost };
  });

  scored.sort((a, b) => b.boost - a.boost || a.base - b.base);

  return {
    hits: scored.slice(0, limit).map(({ candidate }) => candidate),
    matchedDomains,
    ...(persona ? { persona } : {}),
  };
}
