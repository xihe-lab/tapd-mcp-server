// 迭代缺省解析测试（S2）：mock registry，不触真实 API

import assert from 'node:assert/strict';
import { z } from 'zod';
import type { TapdClient, ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry } from '@xihe-lab/tapd-core';
import { pickLatestOpenIteration, probeDefaultIteration } from './iteration.js';

const OPEN_ITERATIONS = {
  data: [
    { id: '3001', name: 'Sprint A', startdate: '2026-09-01', status: 'open' },
    { id: '2999', name: 'Old', startdate: '2026-08-01', status: 'done' },
    { id: '3003', name: 'zzz-delete-me 老迭代', startdate: '2026-12-31', status: 'open' },
    { id: '3002', name: 'Sprint B', startdate: '2026-09-10', status: 'open' },
  ],
};

interface ProbeRecord {
  calls: number;
  args: Record<string, unknown>[];
  mode: 'ok' | 'api-error' | 'auth-error';
}

function makeRegistry(mode: ProbeRecord['mode'] = 'ok'): { registry: ToolRegistry; record: ProbeRecord } {
  const record: ProbeRecord = { calls: 0, args: [], mode };
  const tools: ToolDef[] = [
    {
      name: 'tapd_get_iterations',
      description: 'mock: 迭代查询',
      inputSchema: z.object({
        workspace_id: z.number().optional(),
        id: z.string().optional(),
        status: z.string().optional(),
        fields: z.string().optional(),
        order: z.string().optional(),
      }),
      handler: (_client, params) => {
        record.calls++;
        record.args.push(params as Record<string, unknown>);
        if (record.mode === 'auth-error') {
          return Promise.reject(new Error('missing TAPD_ACCESS_TOKEN'));
        }
        if (record.mode === 'api-error') {
          return Promise.reject(new Error('TAPD API error: 403'));
        }
        return Promise.resolve(OPEN_ITERATIONS);
      },
    },
  ];
  const registry = new ToolRegistry();
  registry.register(tools);
  return { registry, record };
}

const clientFactory = (): TapdClient => ({}) as TapdClient;

const checks: [string, () => void | Promise<void>][] = [
  ['pickLatestOpenIteration：过滤 zzz-delete-me* 与非 open 由调用侧保证，startdate 最新优先', () => {
    const picked = pickLatestOpenIteration(OPEN_ITERATIONS.data);
    assert.ok(picked);
    assert.equal(picked.id, '3002', 'zzz-delete-me(2026-12-31) 必须被过滤，取 startdate 最新的 3002');
    assert.equal(picked.name, 'Sprint B');
  }],
  ['pickLatestOpenIteration：兼容 { data: [...] } / 数组 / 空值形态', () => {
    assert.equal(pickLatestOpenIteration(OPEN_ITERATIONS)!.id, '3002');
    assert.equal(pickLatestOpenIteration([]), undefined);
    assert.equal(pickLatestOpenIteration({ data: [] }), undefined);
    assert.equal(pickLatestOpenIteration({ data: [{ id: '1', name: 'zzz-delete-me', startdate: '2030-01-01' }] }), undefined);
    assert.equal(pickLatestOpenIteration(null), undefined);
    assert.equal(pickLatestOpenIteration('nope'), undefined);
    assert.equal(pickLatestOpenIteration([{ id: '9', name: '唯一', startdate: '' }])!.id, '9');
  }],
  ['probeDefaultIteration：status=open + fields 只读探测，defaultArgs 兜底合并', async () => {
    const { registry, record } = makeRegistry();
    const probe = await probeDefaultIteration(registry, clientFactory, {
      defaultArgs: { workspace_id: 39814312 },
      timeoutMs: 5_000,
    });
    assert.equal(probe.status, 'resolved');
    assert.equal(probe.status === 'resolved' ? probe.iteration.id : '', '3002');
    assert.equal(record.calls, 1);
    assert.equal(record.args[0].status, 'open');
    assert.equal(record.args[0].fields, 'id,name,startdate,status');
    assert.equal(record.args[0].workspace_id, 39814312);
  }],
  ['probeDefaultIteration：无可用迭代 → none（不抛错）', async () => {
    // 全 zzz-delete-me 的迭代列表同样归 none
    const empty = new ToolRegistry();
    empty.register([
      {
        name: 'tapd_get_iterations',
        description: 'mock empty',
        inputSchema: z.object({ status: z.string().optional(), fields: z.string().optional() }),
        handler: () => Promise.resolve({ data: [] }),
      },
    ]);
    const probeEmpty = await probeDefaultIteration(empty, clientFactory);
    assert.equal(probeEmpty.status, 'none');
    const allZzz = new ToolRegistry();
    allZzz.register([
      {
        name: 'tapd_get_iterations',
        description: 'mock all filtered',
        inputSchema: z.object({ status: z.string().optional(), fields: z.string().optional() }),
        handler: () => Promise.resolve([{ id: '1', name: 'zzz-delete-me', startdate: '2030-01-01' }]),
      },
    ]);
    const probeZzz = await probeDefaultIteration(allZzz, clientFactory);
    assert.equal(probeZzz.status, 'none');
  }],
  ['probeDefaultIteration：探测失败（auth/API）→ failed + 消息，不抛错不中断场景', async () => {
    for (const mode of ['auth-error', 'api-error'] as const) {
      const { registry } = makeRegistry(mode);
      const probe = await probeDefaultIteration(registry, clientFactory);
      assert.equal(probe.status, 'failed');
      assert.ok(probe.status === 'failed' && probe.message.length > 0, `${mode} 应带错误消息`);
    }
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
