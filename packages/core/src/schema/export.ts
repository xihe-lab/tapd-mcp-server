import * as z4mini from 'zod/v4-mini';
import type { ZodSchema } from 'zod/v3';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { deriveCommand } from '../registry/derive-command.js';
import type { ToolDef } from '../types.js';

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type SchemaExportFormat = 'anthropic' | 'openai';

export interface SchemaFilter {
  resource?: string;
}

// 与 @modelcontextprotocol/sdk v3 分支的转换参数一致，保证与 tools/list 的 inputSchema 等价
const TO_JSON_SCHEMA_OPTIONS: { strictUnions: boolean; pipeStrategy: 'input' } = {
  strictUnions: true,
  pipeStrategy: 'input',
};

// MCP 侧空 shape 会经 objectFromShape 落到 zod v4-mini 转换，产物无 additionalProperties，
// 此处走同一条路径保持字节级一致
function toInputSchema(inputSchema: unknown): Record<string, unknown> {
  const shape = (inputSchema as { shape?: Record<string, unknown> }).shape;
  if (shape && Object.keys(shape).length === 0) {
    return z4mini.toJSONSchema(z4mini.object({}), { target: 'draft-7', io: 'input' });
  }
  return zodToJsonSchema(inputSchema as ZodSchema, TO_JSON_SCHEMA_OPTIONS);
}

function toToolSchema(tool: ToolDef): ToolSchema {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: toInputSchema(tool.inputSchema),
  };
}

function applyFilter(tools: ToolDef[], filter?: SchemaFilter): ToolDef[] {
  if (!filter?.resource) return tools;
  return tools.filter(tool => deriveCommand(tool.name).resource === filter.resource);
}

export function exportSchemas(tools: ToolDef[], format: SchemaExportFormat, filter?: SchemaFilter): unknown {
  const list = applyFilter(tools, filter).map(toToolSchema);
  if (format === 'anthropic') return list;
  return list.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}
