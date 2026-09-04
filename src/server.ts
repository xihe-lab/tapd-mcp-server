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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapLongIdParams(schema: any): any {
  const shape = schema instanceof z.ZodObject ? schema.shape : schema;
  if (typeof shape !== 'object' || shape === null) return schema;
  const next: Record<string, z.ZodTypeAny> = {};
  let touched = false;
  const entries: [string, z.ZodTypeAny][] = Object.entries(shape);
  for (const [key, field] of entries) {
    if (LONG_ID_PARAM.test(key) && field instanceof z.ZodString) {
      touched = true;
      next[key] = z.preprocess(v => {
        if (typeof v !== 'number') return v;
        if (Number.isSafeInteger(v)) return String(v);
        throw new Error(`参数 ${key} 的值超出 JS 安全整数范围（精度丢失），请以字符串（带引号）重传`);
      }, field);
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
