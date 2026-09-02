import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { McpClient, Reporter, NO_CONFIG_ENV, BASELINE } from './helpers.mjs';

const r = new Reporter('02-tools-parity');
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).tools;
const byName = Object.fromEntries(baseline.map(t => [t.name, t]));

const client = new McpClient({ env: NO_CONFIG_ENV });
try {
  await client.start();
  const tools = await client.listTools();

  r.check(`工具总数 210 (基线 ${baseline.length} / 新版 ${tools.length})`, tools.length === 210 && baseline.length === 210);

  const newNames = new Set(tools.map(t => t.name));
  const baseNames = new Set(baseline.map(t => t.name));
  const missing = [...baseNames].filter(n => !newNames.has(n));
  const extra = [...newNames].filter(n => !baseNames.has(n));
  r.check('工具名集合完全一致 (missing=0, extra=0)', missing.length === 0 && extra.length === 0,
    `missing=${JSON.stringify(missing.slice(0, 10))} extra=${JSON.stringify(extra.slice(0, 10))}`);

  // inputSchema 深比较：先全量哈希比对，再抽 20 个逐字段输出差异
  const diffTools = [];
  const diffDetails = [];
  for (const t of tools) {
    const b = byName[t.name];
    if (!b) continue;
    const aStr = JSON.stringify(stripVolatile(t.inputSchema));
    const bStr = JSON.stringify(stripVolatile(b.inputSchema));
    if (aStr !== bStr) {
      diffTools.push(t.name);
      if (diffDetails.length < 20) {
        const paths = findDiffPaths(b.inputSchema, t.inputSchema);
        diffDetails.push(`${t.name}: ${paths.join('; ')}`);
      }
    }
  }
  r.check('全量 210 个 inputSchema 深比较零漂移', diffTools.length === 0,
    `漂移 ${diffTools.length} 个: ${diffDetails.slice(0, 5).join(' | ')}`);

  // description 顺带比对（FSD 未强制，但漂移值得记录）
  const descDiff = tools.filter(t => byName[t.name] && byName[t.name].description !== t.description).map(t => t.name);
  if (descDiff.length > 0) r.note(`description 有差异的工具 (${descDiff.length}): ${descDiff.slice(0, 10).join(', ')}`);

  // 输出全量哈希供报告引用
  const canonical = JSON.stringify(tools.map(t => ({ name: t.name, inputSchema: stripVolatile(t.inputSchema) })));
  const hash = createHash('sha256').update(canonical).digest('hex');
  const baseCanonical = JSON.stringify(baseline.map(t => ({ name: t.name, inputSchema: stripVolatile(t.inputSchema) })));
  const baseHash = createHash('sha256').update(baseCanonical).digest('hex');
  r.check(`全量 schema sha256 一致 (新版 ${hash.slice(0, 16)}… = 基线 ${baseHash.slice(0, 16)}…)`, hash === baseHash);
} catch (e) {
  r.check('tools/list 深比较执行', false, e.message);
} finally {
  client.stop();
}

// 剔除 $schema 等运行时注入键（与基线格式对齐：基线来自 tools/list 原样输出，理论上无需剔除，
// 保留该函数以便未来 SDK 升级时定位漂移来源）
function stripVolatile(schema) {
  if (schema === null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(stripVolatile);
  const out = {};
  for (const k of Object.keys(schema).sort()) {
    if (k === '$schema') continue;
    out[k] = stripVolatile(schema[k]);
  }
  return out;
}

function findDiffPaths(a, b, prefix = '$') {
  const paths = [];
  const ja = JSON.stringify(sortKeys(a));
  const jb = JSON.stringify(sortKeys(b));
  if (ja === jb) return paths;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        if (a[k] !== undefined && b[k] !== undefined && typeof a[k] === 'object' && typeof b[k] === 'object') {
          paths.push(...findDiffPaths(a[k], b[k], `${prefix}.${k}`));
        } else {
          paths.push(`${prefix}.${k}: ${preview(a[k])} -> ${preview(b[k])}`);
        }
      }
    }
  } else {
    paths.push(`${prefix}: ${preview(a)} -> ${preview(b)}`);
  }
  return paths.slice(0, 5);
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  }
  return v;
}

function preview(v) {
  const s = JSON.stringify(v);
  return s === undefined ? 'undefined' : s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
