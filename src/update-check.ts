/**
 * 启动版本自检（update check）
 *
 * 背景（调研：tapd-knowledge-base/.claude/mcp-autoupdate-research.md）：
 * npx 缓存树只以「根包 spec 的 manifest」为新鲜度探针——`@xihe-lab/tapd-mcp-server@rc`
 * 的 dist-tag 不动，整棵缓存树原样复用，用户可能长期跑在旧版本上而不自知。
 * 本模块在 server 启动后异步查询 npm registry 的 @rc dist-tag，发现新版本时
 * 通过 MCP logging notification（notifications/message）提示用户「重启即更新」。
 *
 * 硬约束：
 *  - 严禁 console.error / stderr 输出：Claude Code 会把 MCP server 的 stderr 一律
 *    当 error 显示（anthropics/claude-code#17653）。唯一出口是 MCP 协议的
 *    logging notification。
 *  - 全程 try-catch + 请求超时兜底：断网 / registry 不可达 / 响应异常一律静默
 *    跳过，绝不影响 server 启动与工具响应。
 *  - 环境开关：TAPD_MCP_UPDATE_CHECK=off（或 false / 0）跳过检查，默认开启。
 */

import { readFileSync } from 'node:fs';
import * as https from 'node:https';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_PKG_NAME = '@xihe-lab/tapd-mcp-server';
const CORE_PKG_NAME = '@xihe-lab/tapd-core';
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
/** 单次 registry 请求超时：自检是纯增益，超时即静默放弃 */
const REQUEST_TIMEOUT_MS = 3000;
/** packument 响应体上限（防御性；超限直接放弃） */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface LocalVersions {
  /** 自身（@xihe-lab/tapd-mcp-server）版本；解析不到时为 null */
  server: string | null;
  /** 内核（@xihe-lab/tapd-core）版本；解析不到时为 null */
  core: string | null;
}

export interface RemoteVersions {
  server: string | null;
  core: string | null;
}

export interface UpdateCheckDeps {
  /** 环境变量来源，默认 process.env（测试注入用） */
  env?: NodeJS.ProcessEnv;
  /** 提示出口，默认由调用方（server.ts）接 MCP logging notification */
  notify?: (message: string) => void | Promise<void>;
  /** registry 探针，默认 https 直连（测试注入用） */
  fetchRc?: (pkgName: string) => string | null | Promise<string | null>;
  /** 版本解析起点模块 URL，默认本模块（测试注入用） */
  fromUrl?: string;
  /** registry 请求超时毫秒数 */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// 版本比较（轻量 semver：仅覆盖本族 2.0.0-rc.N / GA 场景，不引第三方依赖）
// ---------------------------------------------------------------------------

interface ParsedVersion {
  numbers: [number, number, number];
  /** prerelease 标识段；GA（无 prerelease）为 null */
  pre: (string | number)[] | null;
}

export function parseVersion(version: string): ParsedVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim());
  if (!match) return null;
  const pre = match[4]
    ? match[4].split('.').map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg))
    : null;
  return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], pre };
}

/**
 * 返回 1 / -1 / 0 表示 a 相对 b 更新 / 更旧 / 相同；任一版本无法解析时返回 0
 *（解析失败不产生结论，避免误报更新）。
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;

  for (let i = 0; i < 3; i++) {
    if (pa.numbers[i] !== pb.numbers[i]) return pa.numbers[i] > pb.numbers[i] ? 1 : -1;
  }
  // x.y.z > x.y.z-rc.N（GA 优先级高于任何 prerelease）
  if (pa.pre === null || pb.pre === null) {
    if (pa.pre === pb.pre) return 0;
    return pa.pre === null ? 1 : -1;
  }
  const len = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < len; i++) {
    const va = pa.pre[i];
    const vb = pb.pre[i];
    if (va === undefined) return -1; // 前缀短者更旧
    if (vb === undefined) return 1;
    if (va === vb) continue;
    // semver 规则：数字标识段 < 字母标识段
    if (typeof va === 'number' && typeof vb === 'number') return va > vb ? 1 : -1;
    if (typeof va === 'string' && typeof vb === 'string') return va > vb ? 1 : -1;
    return typeof va === 'number' ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 开关与 registry 解析
// ---------------------------------------------------------------------------

export function isUpdateCheckDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.TAPD_MCP_UPDATE_CHECK ?? '').trim().toLowerCase();
  return raw === 'off' || raw === 'false' || raw === '0';
}

/** registry 基址：尊重 npm 镜像环境变量，缺省 npmjs（与 npm CLI 的 env 形态一致） */
export function resolveRegistryBase(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.npm_config_registry ?? env.NPM_CONFIG_REGISTRY ?? DEFAULT_REGISTRY).trim();
  return (raw === '' ? DEFAULT_REGISTRY : raw).replace(/\/+$/, '');
}

/** registry packument URL（scope 的 `/` 需编码为 %2F） */
export function packumentUrl(registryBase: string, pkgName: string): string {
  return `${registryBase.replace(/\/+$/, '')}/${pkgName.replace('/', '%2F')}`;
}

// ---------------------------------------------------------------------------
// 本地版本解析
// ---------------------------------------------------------------------------

/** 从模块所在目录逐级向上找自身 package.json（兼容 dist/bin、dist、src/tsx 各层级） */
function findOwnVersion(fromUrl: string): string | null {
  try {
    let dir = path.dirname(fileURLToPath(fromUrl));
    for (let i = 0; i < 10; i++) {
      try {
        const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
          name?: unknown;
          version?: unknown;
        };
        if (pkg.name === SERVER_PKG_NAME && typeof pkg.version === 'string') return pkg.version;
      } catch {
        // 该层无 package.json 或不可读——继续向上
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // 非文件协议（嵌入等场景）——放弃
  }
  return null;
}

/** 经 node_modules 解析内核包版本；不可达（独立检出等）返回 null */
function readCoreVersion(fromUrl: string): string | null {
  try {
    const pkg = createRequire(fromUrl)(`${CORE_PKG_NAME}/package.json`) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

/** 读自身与内核的本地安装版本；server 版本解析不到时整体放弃 */
export function readLocalVersions(fromUrl: string): LocalVersions | null {
  const server = findOwnVersion(fromUrl);
  if (server === null) return null;
  return { server, core: readCoreVersion(fromUrl) };
}

// ---------------------------------------------------------------------------
// registry 探针（https 直连，不走 npm CLI）
// ---------------------------------------------------------------------------

/** 查询包在 npm registry 上 @rc dist-tag 指向的版本；任何失败返回 null（静默） */
export function fetchRcVersion(
  registryBase: string,
  pkgName: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    try {
      const request = https.get(
        packumentUrl(registryBase, pkgName),
        {
          headers: {
            accept: 'application/vnd.npm.install-v1+json',
            'user-agent': `${SERVER_PKG_NAME} update-check`,
          },
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            done(null);
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
              request.destroy();
              done(null);
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            try {
              const doc = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                'dist-tags'?: Record<string, unknown>;
              };
              const rc = doc['dist-tags']?.rc;
              done(typeof rc === 'string' ? rc : null);
            } catch {
              done(null);
            }
          });
          res.on('error', () => done(null));
        },
      );
      request.on('timeout', () => {
        request.destroy();
        done(null);
      });
      request.on('error', () => done(null));
    } catch {
      done(null);
    }
  });
}

// ---------------------------------------------------------------------------
// 组装与入口
// ---------------------------------------------------------------------------

/** 本地任一包落后于 registry @rc 时返回提示文案；否则返回 null */
export function buildUpdateNotice(
  local: LocalVersions,
  remote: RemoteVersions,
): string | null {
  const parts: string[] = [];
  if (remote.server !== null && local.server !== null && compareVersions(remote.server, local.server) > 0) {
    parts.push(`tapd-mcp-server 有新版本可用（${local.server} → ${remote.server}）`);
  }
  if (remote.core !== null) {
    if (local.core === null) {
      parts.push(`tapd-core 有新版本可用（${remote.core}）`);
    } else if (compareVersions(remote.core, local.core) > 0) {
      parts.push(`tapd-core 有新版本可用（${local.core} → ${remote.core}）`);
    }
  }
  if (parts.length === 0) return null;
  return `${parts.join('；')}——重启 MCP 会话即可更新（Claude Code 可用 /mcp 菜单 Reconnect）。`;
}

/**
 * 启动自检入口：读本地版本 → 查 registry @rc → 有更新则经 notify 提示。
 * 自身保证不抛错、不写 stderr；调用方只需提供 notify（MCP logging notification）。
 */
export async function checkForUpdate(deps: UpdateCheckDeps = {}): Promise<void> {
  try {
    const env = deps.env ?? process.env;
    if (isUpdateCheckDisabled(env)) return;
    const notify = deps.notify;
    if (!notify) return;

    const local = readLocalVersions(deps.fromUrl ?? import.meta.url);
    if (local === null) return;

    const registryBase = resolveRegistryBase(env);
    const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const fetchRc =
      deps.fetchRc ??
      ((pkgName: string) => fetchRcVersion(registryBase, pkgName, timeoutMs));

    const [remoteServer, remoteCore] = await Promise.all([fetchRc(SERVER_PKG_NAME), fetchRc(CORE_PKG_NAME)]);
    const notice = buildUpdateNotice(local, { server: remoteServer, core: remoteCore });
    if (notice !== null) await notify(notice);
  } catch {
    // 自检绝不能干扰 server 启动——所有异常静默吞掉（严禁 stderr）
  }
}
