import type { ToolRegistry } from '../registry/registry.js';

export interface AdvisorEntry {
  toolName: string;
  command: string;
  description: string;
  isWrite: boolean;
  tokens: Set<string>;
  weights: Map<string, number>;
}

export interface AdvisorHit {
  tool: string;
  command: string;
  description: string;
  write: boolean;
  score: number;
}

// 中文口语 → 英文 token（FSD 4.8），命中按 name 级 3 分计
const SYNONYMS: [string, string[]][] = [
  ['切状态', ['status', 'update', 'transition']],
  ['流转', ['status', 'transition', 'workflow']],
  ['扭转', ['status', 'update', 'transition']],
  ['拉迭代', ['iteration', 'list']],
  ['分给我', ['assign', 'owner']],
  ['指派', ['assign', 'owner']],
  ['知识库', ['wiki']],
  ['负责人', ['owner']],
  ['处理人', ['owner']],
  ['评论', ['comment']],
  ['留言', ['comment']],
  ['附件', ['attachment']],
  ['迭代', ['iteration']],
  ['版本', ['version', 'release']],
  ['发布', ['release', 'version']],
  ['需求', ['story']],
  ['缺陷', ['bug']],
  ['任务', ['task']],
  ['文档', ['wiki']],
  ['工时', ['timesheet', 'effort']],
  ['项目', ['project', 'workspace']],
  ['创建', ['create']],
  ['新建', ['create']],
  ['新增', ['create']],
  ['更新', ['update']],
  ['修改', ['update']],
  ['删除', ['delete']],
  ['复制', ['copy']],
  ['克隆', ['copy']],
  ['列表', ['list']],
  ['查询', ['list', 'query']],
  ['查看', ['get', 'list']],
  ['统计', ['count']],
  ['数量', ['count']],
  ['历史', ['changes', 'history']],
  ['关联', ['link', 'relation']],
  ['绑定', ['bind']],
  ['锁定', ['lock']],
  ['解锁', ['unlock']],
  ['用例', ['test', 'case']],
  ['计划', ['plan']],
  ['字段', ['field']],
  ['模板', ['template']],
  ['批量', ['batch']],
];

const SYNONYM_ENTRIES = [...SYNONYMS].sort((a, b) => b[0].length - a[0].length);

const DOMAIN_RANK = ['story', 'bug', 'task', 'iteration', 'wiki', 'comment'];
const PLAIN = Number.MAX_SAFE_INTEGER;
const LATIN_TOKEN = /^[a-z0-9]+$/;
const LATIN_RUN = /[a-z0-9_-]+/g;
const CHINESE_RUN = /[一-鿿]+/g;

interface QueryToken {
  text: string;
  synIdx: number;
}

function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:x|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

function chineseBigrams(text: string): string[] {
  if (text.length <= 1) return text.length === 1 ? [text] : [];
  const out: string[] = [];
  for (let i = 0; i < text.length - 1; i++) out.push(text.slice(i, i + 2));
  return out;
}

function expandSynonyms(run: string): { tokens: QueryToken[]; rest: string } {
  let rest = run;
  const tokens: QueryToken[] = [];
  for (const [key, expansion] of SYNONYM_ENTRIES) {
    if (!rest.includes(key)) continue;
    rest = rest.split(key).join('');
    expansion.forEach((text, synIdx) => tokens.push({ text, synIdx }));
  }
  return { tokens, rest };
}

function tokenize(query: string): QueryToken[] {
  const lowered = query.toLowerCase();
  const merged = new Map<string, number>();
  const add = (text: string, synIdx: number) => {
    const prev = merged.get(text);
    if (prev === undefined || synIdx < prev) merged.set(text, synIdx);
  };
  for (const word of lowered.match(LATIN_RUN) ?? []) {
    for (const part of word.split(/[-_]/)) {
      if (part) add(part, PLAIN);
    }
  }
  for (const run of lowered.match(CHINESE_RUN) ?? []) {
    const { tokens, rest } = expandSynonyms(run);
    for (const token of tokens) add(token.text, token.synIdx);
    for (const bigram of chineseBigrams(rest)) add(bigram, PLAIN);
  }
  return [...merged].map(([text, synIdx]) => ({ text, synIdx }));
}

function withinEditDistance1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edited = false;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (edited) return false;
    edited = true;
    if (la > lb) i++;
    else if (la < lb) j++;
    else {
      i++;
      j++;
    }
  }
  return true;
}

function fuzzyWeight(token: string, entry: AdvisorEntry): number {
  if (token.length < 3 || !LATIN_TOKEN.test(token)) return 0;
  let best = 0;
  for (const [entryToken, weight] of entry.weights) {
    if (!LATIN_TOKEN.test(entryToken)) continue;
    if (entryToken.startsWith(token) || token.startsWith(entryToken)) {
      if (weight > best) best = weight;
    } else if (withinEditDistance1(token, entryToken) && weight > best) {
      best = weight;
    }
  }
  return best;
}

function domainRank(entry: AdvisorEntry): number {
  const idx = DOMAIN_RANK.indexOf(entry.command.split(' ')[0]);
  return idx === -1 ? DOMAIN_RANK.length : idx;
}

export function buildAdvisorIndex(registry: ToolRegistry): AdvisorEntry[] {
  return registry.commands().map(cmd => {
    const tool = registry.get(cmd.tool);
    const weights = new Map<string, number>();
    const add = (token: string, weight: number) => {
      const prev = weights.get(token);
      if (prev === undefined || weight > prev) weights.set(token, weight);
    };
    if (tool?.cli?.alias) add(tool.cli.alias.toLowerCase(), 4);
    for (const seg of cmd.tool.replace(/^tapd_/, '').toLowerCase().split('_')) {
      add(seg, 3);
      const sing = singularize(seg);
      if (sing !== seg) add(sing, 3);
    }
    for (const part of cmd.resource.split('-')) add(part, 2);
    for (const part of cmd.action.split('-')) add(part, 2);
    const description = tool?.description ?? '';
    for (const word of description.toLowerCase().match(/[a-z0-9]+/g) ?? []) add(word, 1);
    for (const run of description.match(CHINESE_RUN) ?? []) {
      for (const bigram of chineseBigrams(run)) add(bigram, 1);
    }
    if (tool?.cli?.examples) {
      for (const example of tool.cli.examples) {
        for (const word of example.toLowerCase().match(/[a-z0-9]+/g) ?? []) add(word, 2);
      }
    }
    return {
      toolName: cmd.tool,
      command: `${cmd.resource} ${cmd.action}`,
      description,
      isWrite: cmd.write,
      tokens: new Set(weights.keys()),
      weights,
    };
  });
}

export function recommend(query: string, index: AdvisorEntry[], limit = 10): AdvisorHit[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const scored: { entry: AdvisorEntry; score: number; priority: number; rank: number }[] = [];
  for (const entry of index) {
    let score = 0;
    let priority = PLAIN;
    for (const qt of qTokens) {
      const direct = entry.weights.get(qt.text);
      if (direct !== undefined) {
        score += qt.synIdx === PLAIN ? direct : 3;
        priority = Math.min(priority, qt.synIdx);
        continue;
      }
      if (qt.synIdx !== PLAIN) continue;
      const fuzzy = fuzzyWeight(qt.text, entry);
      if (fuzzy > 0) {
        score += fuzzy * 0.5;
        priority = Math.min(priority, qt.synIdx);
      }
    }
    if (score <= 0) continue;
    scored.push({ entry, score, priority, rank: domainRank(entry) });
  }

  scored.sort((a, b) =>
    b.score - a.score
    || a.priority - b.priority
    || a.rank - b.rank
    || (a.entry.toolName < b.entry.toolName ? -1 : 1),
  );

  return scored.slice(0, limit).map(({ entry, score }) => ({
    tool: entry.toolName,
    command: entry.command,
    description: entry.description,
    write: entry.isWrite,
    score,
  }));
}
