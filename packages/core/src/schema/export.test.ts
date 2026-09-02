import assert from 'node:assert/strict';
import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { exportSchemas } from './export.js';

function makeTool(overrides: Partial<ToolDef> & { name: string }): ToolDef {
  return {
    description: '获取需求列表',
    inputSchema: z.object({ id: z.string().describe('需求ID') }),
    handler: () => Promise.resolve({ done: true }),
    ...overrides,
  } as ToolDef;
}

const tools = [
  makeTool({ name: 'tapd_get_stories', cli: { resource: 'story', action: 'list' } }),
  makeTool({ name: 'tapd_create_story', cli: { resource: 'story', action: 'create' } }),
  makeTool({ name: 'tapd_get_bugs', cli: { resource: 'bug', action: 'list' } }),
];

const checks: [string, () => Promise<void> | void][] = [
  ['anthropic format returns name/description/input_schema list', () => {
    const result = exportSchemas(tools, 'anthropic') as { name: string; description: string; input_schema: Record<string, unknown> }[];
    assert.equal(result.length, 3);
    const first = result[0];
    assert.equal(first.name, 'tapd_get_stories');
    assert.equal(first.description, '获取需求列表');
    assert.equal(first.input_schema.type, 'object');
  }],

  ['input_schema converts zod object to JSON schema', () => {
    const result = exportSchemas(tools, 'anthropic') as { input_schema: Record<string, unknown> }[];
    const schema = result[0].input_schema as {
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
    assert.equal(schema.properties.id.type, 'string');
    assert.equal(schema.properties.id.description, '需求ID');
    assert.deepEqual(schema.required, ['id']);
  }],

  ['openai format wraps in function calling shape', () => {
    const result = exportSchemas(tools, 'openai') as {
      type: string;
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }[];
    assert.equal(result.length, 3);
    const first = result[0];
    assert.equal(first.type, 'function');
    assert.equal(first.function.name, 'tapd_get_stories');
    assert.equal(first.function.description, '获取需求列表');
    assert.equal(first.function.parameters.type, 'object');
  }],

  ['filter.resource keeps only derived resource match', () => {
    const result = exportSchemas(tools, 'anthropic', { resource: 'story' }) as { name: string }[];
    assert.deepEqual(result.map(t => t.name).sort(), ['tapd_create_story', 'tapd_get_stories']);
  }],

  ['no filter returns all tools', () => {
    const result = exportSchemas(tools, 'openai', {}) as { type: string }[];
    assert.equal(result.length, 3);
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}
if (failed > 0) {
  console.error(`${failed}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`${checks.length}/${checks.length} checks passed`);
