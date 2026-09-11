// unwrapEntities 单元测试：TAPD 包裹形态拍平（真机 L2 冒烟暴露的形态差异，2026-09-11）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrapEntities } from './unwrap.js';

void test('数组逐项解包并附 __entity', () => {
  const data = [
    { Story: { id: '1', name: 'a' } },
    { Story: { id: '2', name: 'b' } },
  ];
  assert.deepEqual(unwrapEntities(data), [
    { id: '1', name: 'a', __entity: 'Story' },
    { id: '2', name: 'b', __entity: 'Story' },
  ]);
});

void test('单对象解包（按 id 查询返回）', () => {
  assert.deepEqual(unwrapEntities({ Iteration: { id: '9', name: 'it' } }), { id: '9', name: 'it', __entity: 'Iteration' });
});

void test('小写单键对象不动（count 等非实体形态）', () => {
  assert.deepEqual(unwrapEntities({ count: 3 }), { count: 3 });
  assert.equal(unwrapEntities(42), 42);
  assert.equal(unwrapEntities('x'), 'x');
  assert.equal(unwrapEntities(null), null);
});

void test('多键对象不动（已扁平/混合形态）', () => {
  const flat = { id: '1', name: 'a', status: 'planning' };
  assert.deepEqual(unwrapEntities(flat), flat);
});

void test('包裹值为标量不动（单键值为原始类型的陷阱形态）', () => {
  assert.deepEqual(unwrapEntities({ Code: 'x' }), { Code: 'x' });
});

void test('混合数组：能解的解，不能解的保原样', () => {
  const out = unwrapEntities([{ Bug: { id: '1' } }, { note: 'plain' }]) as Record<string, unknown>[];
  assert.deepEqual(out[0], { id: '1', __entity: 'Bug' });
  assert.deepEqual(out[1], { note: 'plain' });
});
