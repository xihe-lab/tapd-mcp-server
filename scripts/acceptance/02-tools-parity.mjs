import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { McpClient, Reporter, NO_CONFIG_ENV, BASELINE_143 } from './helpers.mjs';

const r = new Reporter('02-tools-parity');
const baseline = JSON.parse(readFileSync(BASELINE_143, 'utf8')).tools;
const byName = Object.fromEntries(baseline.map(t => [t.name, t]));

const client = new McpClient({ env: NO_CONFIG_ENV });
try {
  await client.start();
  const tools = await client.listTools();

  // 2.0.0-rc 口径（1410 后）：对 1.4.3 基线（含长 ID describe 引导）210 存量零漂移 + 恰好新增 2 个富文本转换工具
  const EXPECTED_ADDED = ['tapd_md_to_html', 'tapd_html_to_md'];
  r.check(`工具总数 212 (基线 ${baseline.length} + 2 新增 / 新版 ${tools.length})`,
    tools.length === 212 && baseline.length === 210);

  const newNames = new Set(tools.map(t => t.name));
  const baseNames = new Set(baseline.map(t => t.name));
  const missing = [...baseNames].filter(n => !newNames.has(n));
  const extra = [...newNames].filter(n => !baseNames.has(n));
  r.check(`存量 210 零缺失 + 新增恰好 ${JSON.stringify(EXPECTED_ADDED)}`,
    missing.length === 0 && JSON.stringify(extra) === JSON.stringify(EXPECTED_ADDED),
    `missing=${JSON.stringify(missing.slice(0, 10))} extra=${JSON.stringify(extra.slice(0, 10))}`);

  // inputSchema 深比较：先全量哈希比对，再抽 20 个逐字段输出差异。
  // 1410 补充修复豁免：19 位长 ID 语义字段 z.number() -> z.string()（26 处、20 个工具，
  // 见 EXPECTED_DRIFT）。workspace_id/company_id 短 ID 不在豁免范围，其余漂移即失败。
  const EXPECTED_DRIFT = new Set([
    'tapd_get_workflow_status_map',
    'tapd_get_workflow_step_map',
    'tapd_add_board_card',
    'tapd_get_board_cards',
    'tapd_update_board_card',
    'tapd_get_board_columns',
    'tapd_program_relate_workspace',
    'tapd_program_bind_entities',
    'tapd_get_workspace_reports',
    'tapd_get_story_categories',
    'tapd_get_story_categories_count',
    'tapd_add_story_category',
    'tapd_update_story_category',
    'tapd_get_tcase_categories',
    'tapd_get_tcase_categories_count',
    'tapd_add_tcase_category',
    'tapd_add_module',
    'tapd_update_module',
    'tapd_add_feature',
    'tapd_update_feature',
  ]);
  const diffTools = [];
  const unexpectedDiff = [];
  const diffDetails = [];
  for (const t of tools) {
    const b = byName[t.name];
    if (!b) continue;
    const aStr = JSON.stringify(stripVolatile(t.inputSchema));
    const bStr = JSON.stringify(stripVolatile(b.inputSchema));
    if (aStr !== bStr) {
      diffTools.push(t.name);
      if (!EXPECTED_DRIFT.has(t.name)) unexpectedDiff.push(t.name);
      if (diffDetails.length < 20) {
        const paths = findDiffPaths(b.inputSchema, t.inputSchema);
        diffDetails.push(`${t.name}: ${paths.join('; ')}`);
      }
    }
  }
  r.note(`预期漂移（1410 长 ID 修复白名单 ${EXPECTED_DRIFT.size} 工具）命中 ${diffTools.length} 个: ${diffTools.slice(0, 25).join(', ')}`);
  r.check(`全量 210 个 inputSchema 深比较零意外漂移（豁免 ${EXPECTED_DRIFT.size} 个预期修复）`, unexpectedDiff.length === 0,
    `意外漂移 ${unexpectedDiff.length} 个: ${unexpectedDiff.slice(0, 5).join(' | ')}`);

  // description 顺带比对（FSD 未强制，但漂移值得记录）
  const descDiff = tools.filter(t => byName[t.name] && byName[t.name].description !== t.description).map(t => t.name);
  if (descDiff.length > 0) r.note(`description 有差异的工具 (${descDiff.length}): ${descDiff.slice(0, 10).join(', ')}`);

  // 输出全量哈希供报告引用（212 含新增两工具，与 210 基线哈希不同属预期）
  const canonical = JSON.stringify(tools.map(t => ({ name: t.name, inputSchema: stripVolatile(t.inputSchema) })));
  const hash = createHash('sha256').update(canonical).digest('hex');
  const baseCanonical = JSON.stringify(baseline.map(t => ({ name: t.name, inputSchema: stripVolatile(t.inputSchema) })));
  const baseHash = createHash('sha256').update(baseCanonical).digest('hex');
  r.note(`全量 schema sha256: 新版(212) ${hash.slice(0, 16)}… / 基线(210) ${baseHash.slice(0, 16)}…`);
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
