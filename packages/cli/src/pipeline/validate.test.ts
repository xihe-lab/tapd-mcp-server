import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allTools, ToolRegistry } from '@xihe-lab/tapd-core';
import { validateTemplate } from './validate.js';
import { parseTemplate } from './template.js';

const registry = new ToolRegistry();
registry.register(allTools);

function validate(yaml: string) {
  return validateTemplate(parseTemplate(yaml, 'inline'), registry);
}

const checks: [string, () => void | Promise<void>][] = [
  ['validate: 合法只读模板通过且 writeSteps 为空', () => {
    const result = validate(`
name: ok-read
write: false
steps:
  - id: stories
    uses: tapd_get_stories
    args: { iteration_id: "1001", limit: 5 }
`);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.writeSteps, []);
  }],
  ['validate: 未知命令 → error 且 target 指向 uses', () => {
    const result = validate(`
name: bad-tool
write: false
steps:
  - id: a
    uses: tapd_totally_missing
`);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.target === 'steps.a.uses' && e.message.includes('tapd_totally_missing')));
  }],
  ['validate: 参数不符 zod schema → error（limit 传字符串）', () => {
    const result = validate(`
name: bad-args
write: false
steps:
  - id: a
    uses: tapd_get_stories
    args: { limit: "not-a-number" }
`);
    assert.equal(result.ok, false);
    const issue = result.errors.find(e => e.target === 'steps.a.args.limit');
    assert.ok(issue, JSON.stringify(result.errors));
    assert.ok(issue.message.includes('参数不符 schema'));
  }],
  ['validate: 未知参数名 → error（schema 不包含该字段）', () => {
    const result = validate(`
name: unknown-key
write: false
steps:
  - id: a
    uses: tapd_get_stories
    args: { bogus_param: 1 }
`);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.target === 'steps.a.args.bogus_param'));
  }],
  ['validate: 必填参数缺失 → error（tapd_update_story 缺 id）', () => {
    const result = validate(`
name: missing-required
write: true
steps:
  - id: a
    uses: tapd_update_story
    args: { status: developing }
`);
    assert.equal(result.ok, false);
    const issue = result.errors.find(e => e.target === 'steps.a.args.id');
    assert.ok(issue, JSON.stringify(result.errors));
  }],
  ['validate: 必填参数为步骤间延迟引用 → 跳过静态检查不误报', () => {
    const result = validate(`
name: deferred-ok
write: true
steps:
  - id: fetch
    uses: tapd_get_stories
    args: { iteration_id: "1" }
  - id: patch
    uses: tapd_update_story
    args: { id: "${'$'}{steps.fetch.data.0.id}", status: developing }
    depends_on: [fetch]
`);
    assert.deepEqual(result.writeSteps, ['patch']);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
  }],
  ['validate: 含写步骤未声明 write: true → WRITE_MARKER_MISSING 语义错误', () => {
    const result = validate(`
name: unmarked-write
steps:
  - id: a
    uses: tapd_update_story
    args: { id: "1", status: developing }
`);
    assert.equal(result.ok, false);
    const issue = result.errors.find(e => e.target === 'write');
    assert.ok(issue, JSON.stringify(result.errors));
    assert.ok(issue.message.includes('write: true') && issue.message.includes('a'));
  }],
  ['validate: 声明 write: true 但全只读 → warning 不阻塞', () => {
    const result = validate(`
name: overmarked
write: true
steps:
  - id: a
    uses: tapd_get_stories
    args: { iteration_id: "1" }
`);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some(w => w.target === 'write'));
  }],
  ['validate: 三个内置模板全部通过（写模板正确声明 write）', () => {
    for (const name of ['deliver-story', 'triage-bugs', 'iteration-review']) {
      // 经文件系统加载，覆盖 builtinTemplatesDir 相对路径推导（src/pipeline → ../../templates）
      const source = readFileSync(new URL(`../../templates/${name}.yaml`, import.meta.url), 'utf8');
      const template = parseTemplate(source, name);
      const result = validateTemplate(template, registry);
      assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.errors)}`);
    }
  }],
  ['validate: 引用不存在的步骤 → REF_UNKNOWN 语义错误', () => {
    const result = validate(`
name: bad-ref
write: false
steps:
  - id: a
    uses: tapd_get_stories
    args: { id: "${'$'}{steps.ghost.data.0.id}" }
`);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.message.includes('ghost')));
  }],
  ['validate: where 表达式语法错误 → EXPR_ERROR 语义错误', () => {
    const result = validate(`
name: bad-expr
write: false
steps:
  - id: a
    uses: tapd_get_stories
    where: "steps.a.data.length >"
`);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.message.includes('表达式语法错误')));
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
