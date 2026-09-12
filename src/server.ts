import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ToolDef } from '@xihe-lab/tapd-core';
import { ToolRegistry, TapdClient } from '@xihe-lab/tapd-core';
import { checkForUpdate } from './update-check.js';

let client: TapdClient | null = null;

function getTapdClient(): TapdClient {
  client ??= TapdClient.fromEnv();
  return client;
}

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'tapd-mcp-server',
      version: '1.0.0',
    },
    // 声明 logging 能力：SDK 的 sendLoggingMessage 仅在 capabilities.logging
    // 存在时才真正发出 notifications/message，否则静默丢弃
    { capabilities: { logging: {} } },
  );

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

  // 启动版本自检：异步执行，不阻塞初始化与工具响应；提示经 MCP logging
  // notification 送达（严禁 stderr——Claude Code 会把 server 的 stderr 一律当
  // error 显示）。断网 / registry 不可达时静默跳过；TAPD_MCP_UPDATE_CHECK=off 关闭。
  void checkForUpdate({
    notify: async (message) => {
      await server.server.sendLoggingMessage({ level: 'notice', data: message });
    },
  });

  process.on('SIGINT', () => {
    void server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    void server.close();
    process.exit(0);
  });
}
