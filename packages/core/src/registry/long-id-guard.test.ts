import assert from 'node:assert/strict';
import { z } from 'zod';
import type { ToolDef } from '../types.js';
import type { TapdClient } from '../tapd-client.js';
import type { AuditEvent, CliErrorCode } from './registry.js';
import { ToolRegistry } from './registry.js';

function makeTool(overrides: Partial<ToolDef> & { name: string }): ToolDef {
  return {
    description: 'test tool',
    inputSchema: z.object({}),
    handler: () => Promise.resolve({ done: true }),
    ...overrides,
  } as ToolDef;
}

const fakeFactory = () => ({}) as TapdClient;

const checks: [string, () => Promise<void> | void][] = [
  ['safe integer number id is coerced to string', async () => {
    const registry = new ToolRegistry();
    let received: unknown;
    registry.register([
      makeTool({
        name: 'tapd_get_story',
        inputSchema: z.object({ id: z.string(), workspace_id: z.number().optional() }),
        handler: (_c, params) => {
          received = params;
          return Promise.resolve(params);
        },
      }),
    ]);
    const result = await registry.exec('tapd_get_story', { id: 39814312 }, { entry: 'mcp' }, fakeFactory);
    assert.equal(result.ok, true);
    assert.deepEqual(received, { id: '39814312' });
  }],

  ['unsafe integer number id throws precise error via exec INVALID_ARGS', async () => {
    const registry = new ToolRegistry();
    const codes: (CliErrorCode | undefined)[] = [];
    const audit = (e: AuditEvent) => codes.push(e.errorCode);
    registry.register([
      makeTool({ name: 'tapd_get_story', inputSchema: z.object({ id: z.string() }) }),
    ]);
    const result = await registry.exec(
      'tapd_get_story',
      { id: Number('1139814312001001410') },
      { entry: 'cli', onAudit: audit },
      fakeFactory,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'INVALID_ARGS');
    assert.match(result.error?.message ?? '', /超出 JS 安全整数范围/);
    assert.match(result.error?.message ?? '', /字符串（带引号）重传/);
    assert.equal(codes.at(-1), 'INVALID_ARGS');
  }],

  ['optional id field wrapped: safe number rescued, missing stays optional', async () => {
    const registry = new ToolRegistry();
    let received: unknown;
    registry.register([
      makeTool({
        name: 'tapd_get_stories',
        inputSchema: z.object({
          ids: z.string().optional(),
          workspace_id: z.number().optional(),
        }),
        handler: (_c, params) => {
          received = params;
          return Promise.resolve(params);
        },
      }),
    ]);
    const rescued = await registry.exec('tapd_get_stories', { ids: 123 }, { entry: 'mcp' }, fakeFactory);
    assert.equal(rescued.ok, true);
    assert.deepEqual(received, { ids: '123' });

    const omitted = await registry.exec('tapd_get_stories', {}, { entry: 'mcp' }, fakeFactory);
    assert.equal(omitted.ok, true);
  }],

  ['nullable id field wrapped', async () => {
    const registry = new ToolRegistry();
    let received: unknown;
    registry.register([
      makeTool({
        name: 'tapd_nullable_id',
        inputSchema: z.object({ id: z.string().nullable() }),
        handler: (_c, params) => {
          received = params;
          return Promise.resolve(params);
        },
      }),
    ]);
    const rescued = await registry.exec('tapd_nullable_id', { id: 456 }, { entry: 'mcp' }, fakeFactory);
    assert.equal(rescued.ok, true);
    assert.deepEqual(received, { id: '456' });

    const nulled = await registry.exec('tapd_nullable_id', { id: null }, { entry: 'mcp' }, fakeFactory);
    assert.equal(nulled.ok, true);
    assert.deepEqual(received, { id: null });
  }],

  ['wrapped ids preserve describe guide for CLI help and MCP JSONSchema', () => {
    const guide = '必须以字符串（带引号）传递，禁止传数值';
    const registry = new ToolRegistry();
    registry.register([
      makeTool({
        name: 'tapd_get_story',
        inputSchema: z.object({
          id: z.string().describe(`需求ID；${guide}`),
          ids: z.string().optional().describe(`需求IDs；${guide}`),
        }),
      }),
    ]);
    const shape = (registry.get('tapd_get_story')!.inputSchema as unknown as {
      shape: Record<string, z.ZodTypeAny>;
    }).shape;
    assert.equal(shape.id?.description, `需求ID；${guide}`);
    assert.equal(shape.ids?.description, `需求IDs；${guide}`);
  }],
  ['non-id fields untouched: workspace_id stays number, name stays string', async () => {
    const registry = new ToolRegistry();
    let received: unknown;
    registry.register([
      makeTool({
        name: 'tapd_get_stories',
        inputSchema: z.object({
          workspace_id: z.number().optional(),
          name: z.string().optional(),
          status: z.string().optional(),
        }),
        handler: (_c, params) => {
          received = params;
          return Promise.resolve(params);
        },
      }),
    ]);
    const result = await registry.exec(
      'tapd_get_stories',
      { workspace_id: 39814312, name: 'test' },
      { entry: 'mcp' },
      fakeFactory,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(received, { workspace_id: 39814312, name: 'test' });

    const schema = registry.get('tapd_get_stories')!.inputSchema as unknown as {
      shape: Record<string, z.ZodTypeAny>;
    };
    const inner = schema.shape.workspace_id._def.innerType;
    assert.ok(inner instanceof z.ZodNumber);
  }],

  ['string id passes through unchanged', async () => {
    const registry = new ToolRegistry();
    let received: unknown;
    registry.register([
      makeTool({
        name: 'tapd_get_story',
        inputSchema: z.object({ id: z.string() }),
        handler: (_c, params) => {
          received = params;
          return Promise.resolve(params);
        },
      }),
    ]);
    const result = await registry.exec(
      'tapd_get_story',
      { id: '1139814312001001410' },
      { entry: 'mcp' },
      fakeFactory,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(received, { id: '1139814312001001410' });
  }],

  ['list() exposes guarded schema so MCP SDK registration gets the guard', () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({
        name: 'tapd_get_story',
        inputSchema: z.object({ id: z.string().optional() }),
      }),
    ]);
    const tool = registry.list()[0];
    const shape = (tool.inputSchema as unknown as { shape: Record<string, z.ZodTypeAny> }).shape;
    assert.equal(shape.id.constructor.name, 'ZodOptional');
    const inner = (shape.id as z.ZodOptional<z.ZodTypeAny>)._def.innerType;
    assert.equal(inner.constructor.name, 'ZodEffects');
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length}/${checks.length} passed`);
}
