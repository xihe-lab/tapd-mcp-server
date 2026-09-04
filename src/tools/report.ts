import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const reportTools: ToolDef[] = [
  {
    name: "tapd_get_workspace_reports",
    description: "获取项目报告列表",
    inputSchema: z.object({
      workspace_id: z.number().describe("项目ID (必填)"),
      id: z.number().optional().describe("报表ID"),
      name: z.string().optional().describe("报表名称，支持模糊匹配"),
      type: z.string().optional().describe("报表类型"),
      creator: z.string().optional().describe("创建人"),
      fields: z.string().optional().describe("指定返回字段"),
    }),
    handler: async (client, params) => {
      return client.get("/reports/workspace_reports", params);
    },
  },
  {
    name: "tapd_get_life_times",
    description: "获取状态流转时间统计",
    inputSchema: z.object({
      workspace_id: z.number().describe("项目ID (必填)"),
      entity_type: z.string().describe("对象类型: story/bug/task (必填)"),
      entity_id: z.string().optional().describe('对象ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      status_from: z.string().optional().describe("起始状态"),
      status_to: z.string().optional().describe("目标状态"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则，如 created desc"),
      fields: z.string().optional().describe("指定返回字段"),
    }),
    handler: async (client, params) => {
      return client.get("/life_times", params);
    },
  },
];