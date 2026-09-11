// pm 模板发现与别名解析（S2 框架本体）
//
// 发现口径（设计 §3）：
//   内置  packages/cli/templates/pm/<domain>-<scenario>.yaml（随包发布）
//   用户  ~/.tapd/templates/pm/（TAPD_USER_TEMPLATES_DIR 可改根目录），同别名覆盖内置
//
// pm 模板在 pipeline 模板 schema 之外多一个 frontmatter 字段 domain:（S1 parseTemplate
// 是 strict schema，不认识它），因此本模块负责：
//   1. 扫描目录提取元数据（domain/name/title/write），不认识的文件只产 warning 不炸；
//   2. 执行前剥离 domain 字段再交 S1 parseTemplate 严格校验（loadPmTemplate）。
// 域名兜底来自文件名约定 <domain>-<scenario>.yaml —— 首个 '-' 前为域键。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { builtinTemplatesDir, parseTemplate } from '../pipeline/template.js';
import { PipelineError, type PipelineTemplate } from '../pipeline/types.js';
import { CliError } from '../errors.js';
import { PM_DOMAINS, findDomain } from './domains.js';

export const PM_TEMPLATE_EXTS = ['.yaml', '.yml', '.json'];

export interface PmTemplateEntry {
  /** 域键（frontmatter domain 优先，否则取文件名首段；无法判定为空串 → help 归「其他」） */
  domain: string;
  /** 场景名（文件名去掉 <domain>- 前缀后的剩余部分） */
  scenario: string;
  /** 模板名（frontmatter name，缺省为文件名 stem） */
  name: string;
  title: string;
  write: boolean;
  /** 模板绝对路径 */
  file: string;
  source: 'builtin' | 'user';
  /** 域键是否命中 PM_DOMAINS 元数据表 */
  domainKnown: boolean;
}

export interface PmCatalog {
  /** 已按域序/场景名排序、用户覆盖内置后的生效清单 */
  entries: PmTemplateEntry[];
  /** 发现期跳过的文件及原因（pm 子命令动作时打 stderr，不阻塞其它命令） */
  warnings: string[];
}

/** 内置 pm 模板目录：packages/cli/templates/pm */
export function builtinPmTemplatesDir(): string {
  return path.join(builtinTemplatesDir(), 'pm');
}

/** 用户模板根目录（默认 ~/.tapd/templates，可用 TAPD_USER_TEMPLATES_DIR 覆盖，测试注入用） */
export function userTemplatesRoot(): string {
  const env = process.env.TAPD_USER_TEMPLATES_DIR;
  if (env && env.trim() !== '') return env;
  return path.join(homedir(), '.tapd', 'templates');
}

export function userPmTemplatesDir(): string {
  return path.join(userTemplatesRoot(), 'pm');
}

/** 别名键：域 + 场景（域可为空串 → 「其他」组） */
export function pmAliasKey(entry: Pick<PmTemplateEntry, 'domain' | 'scenario'>): string {
  return `${entry.domain}::${entry.scenario}`;
}

/** 文件名 stem → 域/场景：有 frontmatter domain 时剥掉 <domain>- 前缀，否则首个 '-' 前为域 */
export function splitAlias(stem: string, domain?: string): { domain: string; scenario: string } {
  if (domain) {
    const lower = stem.toLowerCase();
    const prefix = `${domain.toLowerCase()}-`;
    return { domain, scenario: lower.startsWith(prefix) ? stem.slice(domain.length + 1) : stem };
  }
  const idx = stem.indexOf('-');
  if (idx > 0) return { domain: stem.slice(0, idx), scenario: stem.slice(idx + 1) };
  return { domain: '', scenario: stem };
}

interface PmDocMeta {
  domain?: string;
  name?: string;
  title: string;
  write: boolean;
  hasSteps: boolean;
}

/** 只读元数据：容错解析（YAML.parse 兼容 json），结构不合法直接抛错由调用方降级为 warning */
function readPmDocMeta(file: string): PmDocMeta {
  const source = readFileSync(file, 'utf8');
  let doc: unknown;
  try {
    doc = YAML.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new Error(`YAML 解析失败: ${message}`, { cause: error });
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('顶层必须是 YAML 映射（name/steps/...）');
  }
  const d = doc as Record<string, unknown>;
  const domain = typeof d.domain === 'string' && d.domain.trim() !== '' ? d.domain.trim() : undefined;
  if (domain !== undefined && domain !== domain.toLowerCase()) {
    throw new Error(`domain 必须是小写域键（got "${domain}"）`);
  }
  return {
    domain,
    name: typeof d.name === 'string' && d.name.trim() !== '' ? d.name.trim() : undefined,
    title: typeof d.title === 'string' ? d.title : '',
    write: d.write === true,
    hasSteps: Array.isArray(d.steps) && d.steps.length > 0,
  };
}

function scanPmDir(dir: string, source: 'builtin' | 'user', warnings: string[]): PmTemplateEntry[] {
  if (!existsSync(dir)) return [];
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter(f => PM_TEMPLATE_EXTS.includes(path.extname(f).toLowerCase()))
      .sort();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`读取模板目录失败（${dir}）: ${message}`);
    return [];
  }
  const out: PmTemplateEntry[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      if (!statSync(full).isFile()) continue;
      const meta = readPmDocMeta(full);
      if (!meta.hasSteps) {
        warnings.push(`跳过 pm 模板（无 steps）: ${full}`);
        continue;
      }
      const stem = f.replace(/\.(yaml|yml|json)$/i, '');
      const { domain, scenario } = splitAlias(stem, meta.domain);
      if (!scenario) {
        warnings.push(`跳过 pm 模板（无法解析场景名）: ${full}`);
        continue;
      }
      out.push({
        domain,
        scenario,
        name: meta.name ?? stem,
        title: meta.title,
        write: meta.write,
        file: full,
        source,
        domainKnown: findDomain(domain) !== undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`跳过 pm 模板（${message}）: ${full}`);
    }
  }
  return out;
}

function domainOrder(domain: string): number {
  const idx = PM_DOMAINS.findIndex(d => d.key === domain);
  return idx >= 0 ? idx : PM_DOMAINS.length;
}

/** 用户同别名覆盖内置；排序：域表序 → 其他域按域键字典序 → 场景名字典序 */
export function mergePmEntries(builtin: PmTemplateEntry[], user: PmTemplateEntry[]): PmTemplateEntry[] {
  const byAlias = new Map<string, PmTemplateEntry>();
  for (const e of builtin) byAlias.set(pmAliasKey(e), e);
  for (const e of user) byAlias.set(pmAliasKey(e), e);
  return [...byAlias.values()].sort((a, b) => {
    const d = domainOrder(a.domain) - domainOrder(b.domain);
    if (d !== 0) return d;
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.scenario.localeCompare(b.scenario);
  });
}

/** 扫描内置 + 用户目录，产出生效目录（用户同名覆盖内置） */
export function discoverPmTemplates(): PmCatalog {
  const warnings: string[] = [];
  const builtin = scanPmDir(builtinPmTemplatesDir(), 'builtin', warnings);
  const user = scanPmDir(userPmTemplatesDir(), 'user', warnings);
  return { entries: mergePmEntries(builtin, user), warnings };
}

/**
 * 别名解析：tapd pm <domain> <scenario> → 模板条目。
 * 未命中时按「域不存在 / 域存在但场景缺失」给可操作的错误信息。
 */
export function resolvePmEntry(catalog: PmCatalog, domain: string, scenario: string): PmTemplateEntry {
  const hit =
    catalog.entries.find(e => e.domain === domain && e.scenario === scenario) ??
    catalog.entries.find(e => e.name === `${domain}-${scenario}`);
  if (hit) return hit;
  if (!findDomain(domain) && !catalog.entries.some(e => e.domain === domain)) {
    throw new CliError(
      'INVALID_ARGS',
      `未知域 "${domain}"，可用域: ${PM_DOMAINS.map(d => d.key).join(', ')}（tapd pm --help 查看域分组）`,
    );
  }
  const peers = catalog.entries.filter(e => e.domain === domain).map(e => e.scenario);
  throw new CliError(
    'INVALID_ARGS',
    `域 ${domain} 下没有场景 "${scenario}"，可用场景: ${
      peers.length > 0 ? peers.join(', ') : '（暂无，放置 templates/pm/<domain>-<scenario>.yaml 即自动收录）'
    }`,
  );
}

/**
 * 加载并剥离 pm 元数据后交 S1 引擎严格校验：
 * frontmatter 的 domain 字段由 pm 层消费，parseTemplate 是 strict schema，
 * 不剥离会以 TEMPLATE_INVALID 拒绝。
 */
export function loadPmTemplate(entry: PmTemplateEntry): { template: PipelineTemplate; path: string } {
  let source: string;
  try {
    source = readFileSync(entry.file, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PipelineError('IO', `读取 pm 模板失败（${entry.file}）: ${message}`);
  }
  let doc: unknown;
  try {
    doc = YAML.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new PipelineError('TEMPLATE_INVALID', `pm 模板解析失败（${entry.file}）: ${message}`);
  }
  if (doc && typeof doc === 'object' && !Array.isArray(doc) && 'domain' in (doc as Record<string, unknown>)) {
    delete (doc as Record<string, unknown>).domain;
  }
  // YAML 序列化回灌 parseTemplate（JSON 亦为合法 YAML，这里用 YAML.stringify 保真）
  const template = parseTemplate(YAML.stringify(doc), entry.file);
  return { template, path: entry.file };
}
