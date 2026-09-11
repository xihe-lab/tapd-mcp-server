import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry, TapdClient } from '@xihe-lab/tapd-core';

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

export function registerTools(server: McpServer, tools: ToolDef[]): void {
  const registry = new ToolRegistry();
  registry.register(tools);

  for (const tool of registry.list()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = (tool.inputSchema as any).shape ?? tool.inputSchema;
    server.tool(
      tool.name,
      tool.description,
      schema,
      async (args: unknown) => {
        const result = await registry.exec(tool.name, args, { entry: 'mcp' }, getTapdClient);
        if (result.ok) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result.data, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: result.error?.message }, null, 2),
            },
          ],
          isError: true,
        };
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
