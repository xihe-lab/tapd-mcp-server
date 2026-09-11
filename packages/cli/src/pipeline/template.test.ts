import assert from 'node:assert/strict';
import { listBuiltinTemplates, parseTemplate, resolveTemplatePath } from './template.js';
import { PipelineError } from './types.js';

const checks: [string, () => void | Promise<void>][] = [
  ['parseTemplate: 合法模板完整解析（name/title/write/vars/steps/report）', () => {
    const tpl = parseTemplate(
      `
name: demo
title: 演示模板
write: true
vars:
  iteration_id: "1001"
steps:
  - id: a
    uses: tapd_get_stories
    args: { iteration_id: "${'$'}{vars.iteration_id}" }
    filter: "!item.name.startsWith('zzz')"
  - id: b
    uses: tapd_update_story
    args: { id: "1", status: developing }
    depends_on: [a]
report:
  format: markdown
  template: |
    # 报告 ${'$'}{steps.a.data | length}
`,
      'inline',
    );
    assert.equal(tpl.name, 'demo');
    assert.equal(tpl.write, true);
    assert.equal(tpl.vars?.iteration_id, '1001');
    assert.equal(tpl.steps.length, 2);
    assert.equal(tpl.steps[1].depends_on?.[0], 'a');
    assert.equal(tpl.report?.format, 'markdown');
  }],
  ['parseTemplate: json 源同样可解析（YAML 是 JSON 超集）', () => {
    const tpl = parseTemplate(JSON.stringify({ name: 'j', steps: [{ id: 's', uses: 'tapd_get_bugs' }] }), 'inline');
    assert.equal(tpl.name, 'j');
    assert.equal(tpl.steps[0].uses, 'tapd_get_bugs');
  }],
  ['parseTemplate: yaml 语法错误 → TEMPLATE_INVALID', () => {
    assert.throws(
      () => parseTemplate('name: [unclosed', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
  }],
  ['parseTemplate: 缺 name / 空 steps → TEMPLATE_INVALID', () => {
    assert.throws(
      () => parseTemplate('steps: [{ id: a, uses: x }]', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
    assert.throws(
      () => parseTemplate('name: demo, steps: []'.replace(',', '\n'), 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
  }],
  ['parseTemplate: 步骤缺 uses/expr 或两者同存 → TEMPLATE_INVALID', () => {
    assert.throws(
      () => parseTemplate('name: d\nsteps:\n  - id: a\n    args: {}', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
    assert.throws(
      () => parseTemplate('name: d\nsteps:\n  - id: a\n    uses: tapd_get_bugs\n    expr: "1+1"', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
  }],
  ['parseTemplate: 步骤 id 重复 → TEMPLATE_INVALID', () => {
    assert.throws(
      () => parseTemplate('name: d\nsteps:\n  - id: a\n    uses: tapd_get_bugs\n  - id: a\n    uses: tapd_get_bugs', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
  }],
  ['parseTemplate: depends_on 指向缺失步骤 → TEMPLATE_INVALID', () => {
    assert.throws(
      () => parseTemplate('name: d\nsteps:\n  - id: a\n    uses: tapd_get_bugs\n    depends_on: [ghost]', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
  }],
  ['parseTemplate: 未知顶层字段 → TEMPLATE_INVALID（strict）', () => {
    assert.throws(
      () => parseTemplate('name: d\nsteps:\n  - id: a\n    uses: tapd_get_bugs\nbogus: 1', 'inline'),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
  }],
  ['resolveTemplatePath: 内置模板裸名与 templates/ 相对名都可解析', () => {
    const bare = resolveTemplatePath('iteration-review');
    const rel = resolveTemplatePath('templates/iteration-review.yaml');
    assert.ok(bare.endsWith('packages/cli/templates/iteration-review.yaml'), bare);
    assert.equal(bare, rel);
  }],
  ['resolveTemplatePath: 找不到 → IO 错误并列出尝试路径', () => {
    assert.throws(
      () => resolveTemplatePath('no-such-template'),
      (error: unknown) => error instanceof PipelineError && error.code === 'IO' && error.message.includes('no-such-template'),
    );
  }],
  ['listBuiltinTemplates: 三个内置模板齐全且声明正确的 write 标记', () => {
    const list = listBuiltinTemplates();
    const byName = Object.fromEntries(list.map(t => [t.name, t]));
    assert.deepEqual(Object.keys(byName).sort(), ['deliver-story', 'iteration-review', 'triage-bugs']);
    assert.equal(byName['iteration-review'].write, false);
    assert.equal(byName['deliver-story'].write, true);
    assert.equal(byName['triage-bugs'].write, true);
    assert.ok(byName['iteration-review'].title.length > 0);
  }],
];

let failed = 0;
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
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
