import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { ToolDef } from './types.js';
import { TapdClient } from './tapd-client.js';

let client: TapdClient | null = null;

function getTapdClient(): TapdClient {
  client ??= TapdClient.fromEnv();
  return client;
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'tapd-mcp-server',
    version: '1.0.0',
  });

  return server;
}

const LONG_ID_PARAM = /^(id|ids)$|^([a-z_]+_ids?)$/;

function wrapLongIdField(field: z.ZodTypeAny, key: string): z.ZodTypeAny | null {
  const wrap = (inner: z.ZodString) =>
    z.preprocess(v => {
      if (typeof v !== 'number') return v;
      if (Number.isSafeInteger(v)) return String(v);
      throw new Error(`参数 ${key} 的值超出 JS 安全整数范围（精度丢失），请以字符串（带引号）重传`);
    }, inner);

  if (field instanceof z.ZodString) return wrap(field);
  if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
    const inner = field._def.innerType;
    if (!(inner instanceof z.ZodString)) return null;
    const core = wrap(inner);
    const rebuilt = field instanceof z.ZodOptional ? core.optional() : core.nullable();
    return field.description ? rebuilt.describe(field.description) : rebuilt;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapLongIdParams(schema: any): any {
  const shape = schema instanceof z.ZodObject ? schema.shape : schema;
  if (typeof shape !== 'object' || shape === null) return schema;
  const next: Record<string, z.ZodTypeAny> = {};
  let touched = false;
  const entries: [string, z.ZodTypeAny][] = Object.entries(shape);
  for (const [key, field] of entries) {
    const wrapped = LONG_ID_PARAM.test(key) ? wrapLongIdField(field, key) : null;
    if (wrapped) {
      touched = true;
      next[key] = wrapped;
    } else {
      next[key] = field;
    }
  }
  return touched ? next : shape;
}

export function registerTools(server: McpServer, tools: ToolDef[]): void {
  for (const tool of tools) {
    const schema = wrapLongIdParams(tool.inputSchema);
    server.tool(
      tool.name,
      tool.description,
      schema,
      async (args: unknown) => {
        try {
          const tapdClient = getTapdClient();
          const result = await tool.handler(tapdClient, args);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}

export async function start(tools: ToolDef[]): Promise<void> {
  const server = createServer();
  registerTools(server, tools);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', () => {
    void server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    void server.close();
    process.exit(0);
  });
}
