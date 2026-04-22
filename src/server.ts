import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ToolDef } from './types.js';
import { TapdClient } from './tapd-client.js';
import type { z } from 'zod';

function createTapdClient(): TapdClient {
  return TapdClient.fromEnv();
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'tapd-mcp-server',
    version: '1.0.0',
  });

  return server;
}

export function registerTools(server: McpServer, tools: ToolDef[]): void {
  const client = createTapdClient();

  for (const tool of tools) {
    const schemaShape = (tool.inputSchema as z.ZodObject<z.ZodRawShape>).shape ?? tool.inputSchema;
    server.tool(
      tool.name,
      tool.description,
      schemaShape,
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(client, args);
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
