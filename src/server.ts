/**
 * P1-3/P1-4/P2-1（迭代 1139814312001000122 · FSD §3.4/§3.5/§3.7）：MCP 分级挂载。
 *
 * 核心不变量（不可偏离）：
 *   - 激活即注册、未注册即不可调用：SDK CallTool 路由只认 server.tool() 注册过的
 *     工具名（未注册直接 "Tool X not found"），可见性即权限边界。
 *   - 启动注册面 = resolveStartupTools(env)（默认集 8 域 85 工具，
 *     TAPD_TOOLSETS 追加域 / all 全量，TAPD_TOOLS 白名单回补）。
 *   - tapd_discover_tools 元工具：无参列出全部工具集（id/工具数/是否激活/是否默认集）；
 *     {toolset:"<id>"} 立即注册该域全部工具并触发 tools/list_changed（SDK 在每次
 *     server.tool() 时自动 sendToolListChanged，无需手动调用）；幂等可重复调用。
 *   - TAPD_PERMISSION_MODE=readonly：写工具不进入注册面（ListTools 不可见），
 *     exec 层 READ_ONLY_BLOCKED 双保险。
 *
 * ListTools 覆写沿用 P0-1/P0-3 设计：tools/list 载荷由 core 的 buildToolsListPayload
 * 一体产出（转换 + slim + annotations），且只包含当前已激活（registered）的工具 + discover。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { ToolDef } from '@xihe-lab/tapd-core';
import {
  TOOLSET_DEFINITIONS,
  ToolRegistry,
  TapdClient,
  buildToolsListPayload,
  resolveStartupTools,
  resolveWrite,
} from '@xihe-lab/tapd-core';
import { checkForUpdate } from './update-check.js';

/** discover 元工具名（工具清单内常驻，不计入工具集成员） */
export const DISCOVER_TOOL_NAME = 'tapd_discover_tools';

let client: TapdClient | null = null;

function getTapdClient(): TapdClient {
  client ??= TapdClient.fromEnv();
  return client;
}

/** P2-1（FSD §3.7）：TAPD_PERMISSION_MODE=readonly（大小写不敏感）进入只读档 */
export function isReadonlyMode(env: Record<string, string | undefined> = process.env): boolean {
  return (env.TAPD_PERMISSION_MODE ?? '').trim().toLowerCase() === 'readonly';
}

/**
 * discover 元工具描述：动态枚举全部工具集（id / 展示名 / 工具数 / 是否默认集），
 * 保证与 TOOLSET_DEFINITIONS 永远同步（新域登记即自动出现在路由表）。
 */
function buildDiscoverDescription(): string {
  const lines = TOOLSET_DEFINITIONS.map((d) => {
    const mark = DEFAULT_MARK.has(d.id) ? ' [默认]' : '';
    return `- ${d.id}（${d.label}，${d.tools.length} 工具）${mark}`;
  }).join('\n');
  return [
    'TAPD 工具集发现与按需激活（分级挂载元工具）。',
    '',
    '不带参数调用：列出全部工具集及当前激活状态（{id, label, toolCount, active, isDefault}）。',
    '传 {"toolset":"<id>"}：立即注册该域全部工具（幂等，重复调用安全），无需重启服务；',
    '传 {"toolset":"all"}：一次性激活全部域（等价 TAPD_TOOLSETS=all）。',
    '',
    '全部工具集：',
    lines,
    '',
    '[默认] 域在服务启动时已激活；其余域需先经本工具激活后才能调用其成员工具。',
  ].join('\n');
}

const DEFAULT_MARK = new Set(['workspace', 'iteration', 'user', 'story', 'bug', 'task', 'comment', 'utility']);

/** discover 元工具的输入 schema（toolset 可选；空 = 只列表） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DISCOVER_INPUT_SCHEMA: any = z.object({
  toolset: z
    .string()
    .optional()
    .describe('要激活的工具集 id（见无参调用返回的列表；all = 全部域）。缺省 = 只列表不激活'),
});

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'tapd-mcp-server',
      version: '1.0.0',
    },
    // 声明 logging 能力：SDK 的 sendLoggingMessage 仅在 capabilities.logging
    // 存在时才真正发出 notifications/message，否则静默丢弃。
    // tools + listChanged 能力由 SDK 在首次 server.tool() 时自动登记，无需显式声明。
    { capabilities: { logging: {} } },
  );

  return server;
}

export interface RegisterToolsResult {
  /** env 非法输入告警（未知域/未知工具），经 MCP logging notification 透出 */
  readonly warnings: readonly string[];
}

/**
 * 分级注册（P1-3/P1-4/P2-1）。
 *
 * @param server MCP server 实例
 * @param tools 候选全集（bin 传 allTools；测试可传子集）
 * @param env 环境变量来源（默认 process.env；测试注入用）
 */
export function registerTools(
  server: McpServer,
  tools: ToolDef[],
  env: Record<string, string | undefined> = process.env,
): RegisterToolsResult {
  const registry = new ToolRegistry();
  const readOnlyMode = isReadonlyMode(env);

  // 候选全集进 registry（exec 路由依据）；SDK 注册面才是可见性边界
  registry.register(tools);

  // P1-3：解析启动注册面（默认集 + env 追加/白名单）
  const startup = resolveStartupTools(env);
  const startupNames = new Set(startup.tools.map((t) => t.name));

  // P2-1：只读档下写工具整体出局（不可见即不可调用；exec 层 READ_ONLY_BLOCKED 双保险）
  const eligible = (tool: ToolDef): boolean => !readOnlyMode || !resolveWrite(tool);

  /** 当前 SDK 已注册工具名（discover 幂等 + ListTools 载荷过滤依据） */
  const registered = new Set<string>();

  const registerSingleTool = (tool: ToolDef): void => {
    if (registered.has(tool.name)) return; // 幂等：SDK 重复注册会抛错
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = (tool.inputSchema as any).shape ?? tool.inputSchema;
    server.tool(
      tool.name,
      tool.description,
      schema,
      async (args: unknown) => {
        const result = await registry.exec(tool.name, args, { entry: 'mcp', readOnly: readOnlyMode }, getTapdClient);
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
    registered.add(tool.name);
  };

  // 启动注册面（顺序与 core allTools 一致，确定性输出）。
  // 资格判定必须用 registry 合并后的工具（EXPLICIT_WRITE 等写策略标记在 register
  // 时合入）：直接判原始 tool 会漏判 tapd_change_workitem_type 这类无写动词的写工具。
  for (const tool of tools) {
    if (!startupNames.has(tool.name)) continue;
    const merged = registry.get(tool.name) ?? tool;
    if (eligible(merged)) registerSingleTool(merged);
  }

  // P1-4：discover 元工具。不走 registry.exec（其 clientFactory 在无凭据时会
  // AUTH_MISSING，而列表/激活是纯本地操作必须免凭据可用），直接内联 handler。
  const toolsetOf = new Map(TOOLSET_DEFINITIONS.map((d) => [d.id, d]));
  const registerToolset = (id: string): number => {
    const def = toolsetOf.get(id);
    if (!def) return 0;
    let added = 0;
    for (const name of def.tools) {
      const tool = registry.get(name);
      if (tool && eligible(tool) && !registered.has(name)) {
        registerSingleTool(tool);
        added += 1;
      }
    }
    return added;
  };

  const discoverListPayload = (): { toolsets: unknown[]; hint: string } => {
    const activeCount = [...registered].filter((n) => n !== DISCOVER_TOOL_NAME).length;
    const list = TOOLSET_DEFINITIONS.map((d) => ({
      id: d.id,
      label: d.label,
      toolCount: d.tools.length,
      active: d.tools.every((n) => registered.has(n)) && d.tools.length > 0,
      isDefault: DEFAULT_MARK.has(d.id),
    }));
    return {
      toolsets: list,
      hint: `当前已激活 ${activeCount} 个工具（不含本工具）。传 {"toolset":"<id>"} 激活对应域（幂等）；传 {"toolset":"all"} 激活全部域。`,
    };
  };

  const textResult = (payload: unknown, isError = false) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  });

  // ---- discover 注册（单次；SDK 对同名重复注册会抛错）----
  const discoverTool: ToolDef = {
    name: DISCOVER_TOOL_NAME,
    description: buildDiscoverDescription(),
    inputSchema: DISCOVER_INPUT_SCHEMA,
    // eslint-disable-next-line @typescript-eslint/require-await -- ToolDef.handler 签名要求 async；占位实现同步抛出
    handler: async () => {
      throw new Error('discover is dispatched inline, not via registry.exec');
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoverSchema = (discoverTool.inputSchema as any).shape ?? discoverTool.inputSchema;
  server.tool(
    DISCOVER_TOOL_NAME,
    discoverTool.description,
    discoverSchema,
    // eslint-disable-next-line @typescript-eslint/require-await -- 列表/激活均为同步本地操作；保留 async 匹配 SDK 回调签名
    async (args: unknown) => {
      const raw = (args as { toolset?: unknown } | undefined)?.toolset;
      if (typeof raw !== 'string' || raw.trim() === '') {
        return textResult(discoverListPayload());
      }
      const id = raw.trim().toLowerCase();
      if (id === 'all') {
        let added = 0;
        for (const def of TOOLSET_DEFINITIONS) added += registerToolset(def.id);
        return textResult({
          activated: 'all',
          added,
          totalTools: [...registered].filter((n) => n !== DISCOVER_TOOL_NAME).length,
          note: '全部域已激活（tools/list 已更新）。等价启动配置 TAPD_TOOLSETS=all。',
        });
      }
      if (!toolsetOf.has(id)) {
        return textResult(
          {
            error: `未知工具集「${raw}」。可用值: ${TOOLSET_DEFINITIONS.map((d) => d.id).join(', ')}（或 all）`,
            hint: '也可设置环境变量 TAPD_TOOLSETS=all 在启动时挂载全部工具集。',
          },
          true,
        );
      }
      const added = registerToolset(id);
      return textResult({
        activated: id,
        added,
        totalTools: [...registered].filter((n) => n !== DISCOVER_TOOL_NAME).length,
        note: '工具集已激活（幂等：重复激活 added=0，tools/list 已更新）。',
      });
    },
  );
  registered.add(DISCOVER_TOOL_NAME);

  // P0-1/P0-3（迭代 1139814312001000122）：覆写 ListTools 处理器——
  // SDK 内部 zod→JSON 转换不可注入 slim 逻辑，改由 core 的 buildToolsListPayload
  // 一体产出（转换 + slim + annotations），与 exportSchemas 字节级一致。
  // P1-3：载荷只含当前已激活（registered）的工具 + discover——未注册工具不出现在
  // 客户端工具清单里（可见性即权限边界）。必须在首次 server.tool() 之后安装本覆写
  //（SDK 首次注册工具时才初始化工具处理器并自动登记 listChanged 能力）。
  // eslint-disable-next-line @typescript-eslint/require-await
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...buildToolsListPayload(tools.filter((t) => registered.has(t.name))),
      ...buildToolsListPayload([discoverTool]),
    ],
  }));

  return { warnings: startup.warnings };
}

export async function start(tools: ToolDef[], env: Record<string, string | undefined> = process.env): Promise<void> {
  const server = createServer();
  const { warnings } = registerTools(server, tools, env);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const notify = async (message: string): Promise<void> => {
    await server.server.sendLoggingMessage({ level: 'notice', data: message });
  };

  // 启动注册面告警（未知域/未知工具）：唯一出口是 MCP logging notification
  //（严禁 stderr——Claude Code 会把 server 的 stderr 一律当 error 显示）。
  for (const warning of warnings) {
    await notify(warning).catch(() => undefined);
  }

  // 启动版本自检：异步执行，不阻塞初始化与工具响应；提示经 MCP logging
  // notification 送达。断网 / registry 不可达时静默跳过；TAPD_MCP_UPDATE_CHECK=off 关闭。
  void checkForUpdate({ notify });

  process.on('SIGINT', () => {
    void server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    void server.close();
    process.exit(0);
  });
}
