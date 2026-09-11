import assert from 'node:assert/strict';
import {
  checkExprSyntax,
  evalExprStep,
  evalFilter,
  evalRef,
  evalWhere,
  extractStepRefs,
  interpolate,
  interpolateForPreview,
  isDeferredStepRef,
} from './expression.js';
import { PipelineError } from './types.js';

const ctx = {
  vars: { iteration_id: '1001', owners: ['alice', 'bob'], nested: { a: { b: 'c' } } },
  steps: {
    stories: { data: [{ id: '1', name: 's1' }, { id: '2', name: 'zzz-delete-me' }] },
    stats: { data: { total: 2 } },
  },
};

const checks: [string, () => void | Promise<void>][] = [
  ['evalRef: vars 取值', () => {
    assert.equal(evalRef('vars.iteration_id', ctx), '1001');
  }],
  ['evalRef: steps → step → data → 数组下标 → 字段', () => {
    assert.equal(evalRef('steps.stories.data.0.id', ctx), '1');
    assert.equal(evalRef('steps.stats.data.total', ctx), 2);
  }],
  ['evalRef: 缺失路径返回 undefined 而非抛错', () => {
    assert.equal(evalRef('vars.nope', ctx), undefined);
    assert.equal(evalRef('steps.stories.data.9.id', ctx), undefined);
  }],
  ['evalRef: 非 vars/steps 开头 → EXPR_ERROR', () => {
    assert.throws(
      () => evalRef('item.name', ctx),
      (error: unknown) => error instanceof PipelineError && error.code === 'EXPR_ERROR',
    );
  }],
  ['interpolate: 整串 ${...} 保留原生类型（数字/数组/对象）', () => {
    assert.deepEqual(interpolate('${vars.owners}', ctx), ['alice', 'bob']);
    assert.deepEqual(interpolate('${steps.stats.data}', ctx), { total: 2 });
  }],
  ['interpolate: 嵌入式插值按字符串拼接', () => {
    assert.equal(interpolate('迭代 ${vars.iteration_id} 共 ${steps.stats.data.total} 条', ctx), '迭代 1001 共 2 条');
    assert.equal(interpolate('缺失=${vars.nope}!', ctx), '缺失=!');
  }],
  ['interpolate: 深遍历对象与数组', () => {
    assert.deepEqual(interpolate({ a: ['${vars.iteration_id}'], b: { c: '${steps.stats.data.total}' } }, ctx), {
      a: ['1001'],
      b: { c: 2 },
    });
  }],
  ['filters: length / count / json / join / keys', () => {
    assert.equal(evalRef('steps.stories.data | length', ctx), 2);
    assert.equal(evalRef('steps.stories.data | count', ctx), 2);
    assert.equal(evalRef('steps.stats.data | json', ctx), '{\n  "total": 2\n}');
    assert.equal(evalRef('vars.owners | join "、"', ctx), 'alice、bob');
    assert.deepEqual(evalRef('steps.stats.data | keys', ctx), ['total']);
  }],
  ['filters: rows 渲染 markdown 表格行并转义管道符', () => {
    const rows = evalRef('steps.stories.data | rows id,name', ctx);
    assert.equal(rows, '| 1 | s1 |\n| 2 | zzz-delete-me |');
    const escaped = evalRef('vars.piped | rows x', { vars: { piped: [{ x: 'a|b' }] }, steps: {} });
    assert.equal(escaped, '| a\\|b |');
  }],
  ['filters: 未知过滤器 → EXPR_ERROR', () => {
    assert.throws(
      () => evalRef('steps.stats.data | bogus', ctx),
      (error: unknown) => error instanceof PipelineError && error.code === 'EXPR_ERROR',
    );
  }],
  ['extractStepRefs: 收集 args/where/filter 中的步骤引用（去重）', () => {
    assert.deepEqual(extractStepRefs({ id: '${steps.a.data.0.id}', flag: 'steps.a.data.length > 0' }), ['a']);
    assert.deepEqual(extractStepRefs('steps.b.data.length > 0 && steps.a.ok'), ['b', 'a']);
    assert.deepEqual(extractStepRefs('${vars.x}'), []);
  }],
  ['evalWhere: 布尔上下文与 today 变量', () => {
    assert.equal(evalWhere('steps.stories.data.length > 1', ctx), true);
    assert.equal(evalWhere('vars.iteration_id == "1001" && today.length === 10', ctx), true);
    assert.equal(evalWhere('false', ctx), false);
  }],
  ['evalFilter: item/index 上下文逐项过滤', () => {
    const kept = evalFilter("!item.name.startsWith('zzz-delete-me')", ctx.steps.stories.data, ctx);
    assert.deepEqual(kept, [{ id: '1', name: 's1' }]);
    assert.deepEqual(evalFilter('index > 0', [1, 2, 3], ctx), [2, 3]);
  }],
  ['evalExprStep: 本地计算（map/reduce/对象字面量）', () => {
    const out = evalExprStep('({ sum: steps.stories.data.length + 1, names: steps.stories.data.map(i => i.id) })', ctx);
    // vm 独立 realm 产出的对象原型不同，用 JSON 回环做结构断言
    assert.deepEqual(JSON.parse(JSON.stringify(out)), { sum: 3, names: ['1', '2'] });
  }],
  ['evalExprStep: 非法表达式 → EXPR_ERROR', () => {
    assert.throws(
      () => evalExprStep(')not js(', ctx),
      (error: unknown) => error instanceof PipelineError && error.code === 'EXPR_ERROR',
    );
  }],
  ['checkExprSyntax: 语法错误被捕获且不执行', () => {
    checkExprSyntax('a === b && c(1)', true); // 合法，不抛
    assert.throws(() => checkExprSyntax('a ===', true), PipelineError);
  }],
  ['isDeferredStepRef: 整串 steps 引用识别', () => {
    assert.equal(isDeferredStepRef('${steps.a.data.0.id}'), true);
    assert.equal(isDeferredStepRef('${steps.a.data | json}'), true);
    assert.equal(isDeferredStepRef('${vars.x}'), false);
    assert.equal(isDeferredStepRef('prefix ${steps.a.data} suffix'), false);
  }],
  ['interpolateForPreview: 步骤引用保留原表达式，vars 正常解析', () => {
    assert.equal(interpolateForPreview('${steps.a.data.0.id}', { vars: {}, steps: {} }), '${steps.a.data.0.id}');
    assert.equal(interpolateForPreview('${vars.iteration_id}', ctx), '1001');
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
