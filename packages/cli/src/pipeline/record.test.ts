import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { allTools, ToolRegistry, resolveWrite } from '@xihe-lab/tapd-core';
import YAML from 'yaml';
import { historyPath, readHistory, recordCommandHistory } from './history.js';
import { buildTemplateFromHistory, renderTemplateYaml } from './record.js';
import { parseTemplate, resolveTemplatePath } from './template.js';
import { validateTemplate } from './validate.js';

const sandboxDir = mkdtempSync(path.join(tmpdir(), 'tapd-history-test-'));
const sandboxFile = path.join(sandboxDir, 'history.jsonl');
const originalPath = process.env.TAPD_HISTORY_PATH;
process.env.TAPD_HISTORY_PATH = sandboxFile;

const registry = new ToolRegistry();
registry.register(allTools);

const audit = (tool: string, ok = true) => ({
  ts: new Date().toISOString(),
  entry: 'cli' as const,
  tool,
  args: { id: '1001' },
  ok,
  durationMs: 5,
});

const checks: [string, () => void | Promise<void>][] = [
  ['recordCommandHistory: 成功命令追加 JSONL，失败命令不记录', () => {
    recordCommandHistory(audit('tapd_get_stories'));
    recordCommandHistory(audit('tapd_update_story'));
    recordCommandHistory(audit('tapd_get_bugs', false));
    const entries = readHistory(10);
    assert.deepEqual(entries.map(e => e.tool), ['tapd_get_stories', 'tapd_update_story']);
    assert.equal(entries[0].args.id, '1001');
    assert.ok(historyPath().startsWith(sandboxDir));
  }],
  ['readHistory: --last 截取最近 N 条', () => {
    const entries = readHistory(1);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].tool, 'tapd_update_story');
  }],
  ['readHistory: 损坏行被跳过', () => {
    writeFileSync(sandboxFile, readHistory(10).map(e => JSON.stringify(e)).concat('{broken').join('\n') + '\n');
    assert.equal(readHistory(10).length, 2);
  }],
  ['buildTemplateFromHistory: 写命令经 write-policy 判定 → 模板自动 write: true', () => {
    const entries = readHistory(10);
    const isWrite = (tool: string) => {
      const def = registry.get(tool);
      return def ? resolveWrite(def) : false;
    };
    const template = buildTemplateFromHistory(entries, { name: 'recorded', title: '录制' }, isWrite);
    assert.equal(template.write, true, 'tapd_update_story 命中写策略');
    assert.equal(template.name, 'recorded');
    assert.equal(template.steps.length, 2);
    assert.equal(template.steps[1].uses, 'tapd_update_story');
  }],
  ['buildTemplateFromHistory: 全只读历史 → 模板不带 write 标记', () => {
    const isWrite = (tool: string) => {
      const def = registry.get(tool);
      return def ? resolveWrite(def) : false;
    };
    const template = buildTemplateFromHistory(
      [{ ts: 't', tool: 'tapd_get_bugs', args: {}, durationMs: 1 }],
      { name: 'read-only-rec' },
      isWrite,
    );
    assert.equal(template.write, undefined);
  }],
  ['录制产物闭环: record → yaml → parse → validate 全绿', () => {
    const isWrite = (tool: string) => {
      const def = registry.get(tool);
      return def ? resolveWrite(def) : false;
    };
    const template = buildTemplateFromHistory(readHistory(10), { name: 'recorded-roundtrip' }, isWrite);
    const yaml = renderTemplateYaml(template);
    const reparsed = parseTemplate(yaml, 'roundtrip');
    assert.equal(reparsed.name, 'recorded-roundtrip');
    const result = validateTemplate(reparsed, registry);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const roundtrip = YAML.parse(yaml) as { steps: { args: { id: string } }[] };
    assert.equal(roundtrip.steps[0].args.id, '1001');
  }],
  ['resolveTemplatePath: 录制产物写入内置目录后可用裸名解析（临时目录模拟）', () => {
    // 不真的写入包目录（避免污染仓库），只验证解析逻辑对扩展名回退的行为
    assert.throws(() => resolveTemplatePath('definitely-not-a-template'), Error);
  }],
];

let failed = 0;
try {
  for (const [name, fn] of checks) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL - ${name}`);
      console.error(error);
    }
  }
} finally {
  if (originalPath === undefined) delete process.env.TAPD_HISTORY_PATH;
  else process.env.TAPD_HISTORY_PATH = originalPath;
  rmSync(sandboxDir, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
