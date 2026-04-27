import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const settingsTools: ToolDef[] = [
  {
    name: "tapd_get_modules",
    description: "Get module settings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("项目ID (必填)"),
      id: z.string().optional().describe("id，支持多ID查询"),
      name: z.string().optional().describe("标题，支持模糊匹配"),
      description: z.string().optional().describe("详细描述"),
      owner: z.string().optional().describe("负责人"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("设置返回数量限制，默认为30"),
      page: z.number().optional().describe("返回当前数量限制下第N页的数据，默认为1"),
      order: z.string().optional().describe("排序规则，如 created desc"),
      fields: z.string().optional().describe("设置获取的字段，多个字段间以','逗号隔开"),
    }),
    handler: async (client, params) => {
      return client.get("/modules", params);
    },
  },
  {
    name: "tapd_get_versions",
    description: "Get version settings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("项目ID (必填)"),
      id: z.string().optional().describe("版本ID，支持多ID查询"),
      owner: z.string().optional().describe("负责人"),
      creator: z.string().optional().describe("提交人"),
      name: z.string().optional().describe("版本标题，支持模糊匹配"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      status: z.string().optional().describe("状态：0为未关闭，1为已关闭"),
      limit: z.number().optional().describe("设置返回数量限制，默认为30"),
      page: z.number().optional().describe("返回当前数量限制下第N页的数据，默认为1"),
      fields: z.string().optional().describe("设置获取的字段，多个字段间以','逗号隔开"),
    }),
    handler: async (client, params) => {
      return client.get("/versions", params);
    },
  },
  {
    name: "tapd_get_features",
    description: "Get feature settings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("项目ID (必填)"),
      id: z.string().optional().describe("id，支持多ID查询"),
      name: z.string().optional().describe("标题，支持模糊匹配"),
      description: z.string().optional().describe("详细描述"),
      owner: z.string().optional().describe("负责人"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("设置返回数量限制，默认为30"),
      page: z.number().optional().describe("返回当前数量限制下第N页的数据，默认为1"),
      order: z.string().optional().describe("排序规则，如 created desc"),
      fields: z.string().optional().describe("设置获取的字段，多个字段间以','逗号隔开"),
    }),
    handler: async (client, params) => {
      return client.get("/features", params);
    },
  },
];
