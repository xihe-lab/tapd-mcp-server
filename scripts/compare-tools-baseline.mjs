import { readFileSync } from 'node:fs';

const curPath = process.argv[2];
const basePath = process.argv[3] ?? '/tmp/claude/baseline-tools-143.json';
const expectedAdded = JSON.parse(process.argv[4] ?? '[]');
const cur = JSON.parse(readFileSync(curPath, 'utf8')).tools;
const base = JSON.parse(readFileSync(basePath, 'utf8')).tools;

const curNames = cur.map(t => t.name);
const baseNames = base.map(t => t.name);
if (new Set(curNames).size !== curNames.length) throw new Error('duplicate tool names');

const baseSet = new Set(baseNames);
const curSet = new Set(curNames);
const added = curNames.filter(n => !baseSet.has(n));
const removed = baseNames.filter(n => !curSet.has(n));
const baseMap = Object.fromEntries(base.map(t => [t.name, t]));
const curMap = Object.fromEntries(cur.map(t => [t.name, t]));
const drifted = baseNames.filter(n => curSet.has(n) && JSON.stringify(baseMap[n]) !== JSON.stringify(curMap[n]));

// 1410 补充修复白名单：19 位长 ID 语义字段 z.number() -> z.string()（workitem_type_id/board_id/
// column_id/category_id/program_id/parent_id/id 等），共 26 处、20 个工具。workspace_id/company_id
// 等 10 位以内短 ID 保持 number 不在豁免范围。豁免外出现新 drift 即失败。
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
const unexpectedDrift = drifted.filter(n => !EXPECTED_DRIFT.has(n));

console.log(`current: ${curNames.length}, baseline: ${baseNames.length} (${basePath})`);
console.log(`added: ${JSON.stringify(added)}`);
console.log(`removed: ${JSON.stringify(removed)}`);
console.log(`drifted(baseline subset): ${drifted.length ? drifted.join(',') : 'NONE'}`);
if (drifted.length > 0) {
  console.log(`expected-drift whitelist (1410 long-id fix): ${EXPECTED_DRIFT.size} tools`);
  console.log(`unexpected drift: ${unexpectedDrift.length ? unexpectedDrift.join(',') : 'NONE'}`);
}

const ok = curNames.length === baseNames.length + expectedAdded.length
  && JSON.stringify(added) === JSON.stringify(expectedAdded)
  && removed.length === 0
  && unexpectedDrift.length === 0;
console.log(ok ? 'ZERO-DRIFT OK (whitelisted long-id fix excluded)' : 'ZERO-DRIFT FAILED');
process.exitCode = ok ? 0 : 1;
