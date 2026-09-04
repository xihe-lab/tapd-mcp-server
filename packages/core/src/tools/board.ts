import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const boardTools: ToolDef[] = [
  {
    name: "tapd_add_board_card",
    description: "新建看板工作项",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      board_id: z.string().describe("看板ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      column_id: z.string().describe("看板列ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      name: z.string().describe("工作项标题 (必填)"),
      description: z.string().optional().describe("详细描述"),
      owner: z.string().optional().describe("负责人，默认当前用户"),
      creator: z.string().optional().describe("创建人，默认当前用户"),
      priority: z.string().optional().describe("优先级"),
      category_id: z.string().optional().describe("分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      due: z.string().optional().describe("预计完成日期，格式: YYYY-MM-DD"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/board_cards/add", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_board_cards",
    description: "获取看板工作项列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      board_id: z.string().optional().describe("看板ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      column_id: z.string().optional().describe("看板列ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      id: z.string().optional().describe('工作项ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("工作项标题，支持模糊匹配"),
      owner: z.string().optional().describe("负责人"),
      creator: z.string().optional().describe("创建人"),
      status: z.string().optional().describe("状态"),
      priority: z.string().optional().describe("优先级"),
      category_id: z.string().optional().describe("分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      modified: z.string().optional().describe("修改时间，支持时间查询"),
      due: z.string().optional().describe("预计完成日期，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则，如 created desc"),
      fields: z.string().optional().describe("指定返回字段，多个字段以逗号分隔"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/board_cards", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_board_card",
    description: "更新看板工作项",
    inputSchema: z.object({
      id: z.string().describe('工作项ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      board_id: z.string().optional().describe("看板ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      column_id: z.string().optional().describe("看板列ID（用于移动卡片）；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      name: z.string().optional().describe("工作项标题"),
      description: z.string().optional().describe("详细描述"),
      owner: z.string().optional().describe("负责人"),
      status: z.string().optional().describe("状态"),
      priority: z.string().optional().describe("优先级"),
      due: z.string().optional().describe("预计完成日期，格式: YYYY-MM-DD"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/board_cards/update", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_board_columns",
    description: "获取看板板块",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      board_id: z.string().describe("看板ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      id: z.string().optional().describe("看板列ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      fields: z.string().optional().describe("指定返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/board_columns", { ...params, workspace_id: workspaceId });
    },
  },
];
