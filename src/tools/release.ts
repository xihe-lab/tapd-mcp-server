import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const releaseTools: ToolDef[] = [
  // 发布计划 CRUD
  {
    name: "tapd_get_releases",
    description: "Get releases from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Release ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Release name, supports fuzzy matching"),
      status: z.string().optional().describe("Status of the release"),
      owner: z.string().optional().describe("Owner name"),
      creator: z.string().optional().describe("Creator name"),
      release_date: z.string().optional().describe("Release date"),
      created: z.string().optional().describe("Creation time"),
      modified: z.string().optional().describe("Last modification time"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/releases", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_release",
    description: "创建发布计划",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("发布计划名称 (必填)"),
      description: z.string().optional().describe("详细描述"),
      status: z.string().optional().describe("状态"),
      owner: z.string().optional().describe("发布负责人（默认当前用户）"),
      creator: z.string().optional().describe("创建人（默认当前用户）"),
      release_date: z.string().optional().describe("发布日期 YYYY-MM-DD"),
      start_date: z.string().optional().describe("开始日期 YYYY-MM-DD"),
      end_date: z.string().optional().describe("结束日期 YYYY-MM-DD"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        owner: params.owner ?? nickName,
        creator: params.creator ?? nickName,
      };
      return client.post("/releases", finalParams);
    },
  },
  {
    name: "tapd_update_release",
    description: "更新发布计划",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('发布计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("发布计划名称"),
      description: z.string().optional().describe("详细描述"),
      status: z.string().optional().describe("状态"),
      owner: z.string().optional().describe("发布负责人"),
      release_date: z.string().optional().describe("发布日期 YYYY-MM-DD"),
      start_date: z.string().optional().describe("开始日期 YYYY-MM-DD"),
      end_date: z.string().optional().describe("结束日期 YYYY-MM-DD"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/releases", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_release_count",
    description: "获取发布计划数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('发布计划ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("发布计划名称"),
      status: z.string().optional().describe("状态"),
      owner: z.string().optional().describe("发布负责人"),
      creator: z.string().optional().describe("创建人"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/releases/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 发布评审依据
  {
    name: "tapd_get_launch_accessories",
    description: "获取发布评审依据",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('评审依据ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      launch_id: z.string().optional().describe('发布评审ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      type: z.string().optional().describe("依据类型"),
      creator: z.string().optional().describe("创建人"),
      created: z.string().optional().describe("创建时间"),
      limit: z.number().optional().describe("返回数量，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/launch_accessories", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_launch_accessories",
    description: "创建发布评审依据",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      launch_id: z.string().describe('发布评审ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      type: z.string().describe("依据类型 (必填)"),
      content: z.string().optional().describe("依据内容"),
      creator: z.string().optional().describe("创建人（默认当前用户）"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        creator: params.creator ?? nickName,
      };
      return client.post("/launch_accessories/add", finalParams);
    },
  },
  // 发布评审
  {
    name: "tapd_add_launch_form",
    description: "创建发布评审",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      template_id: z.string().describe('模板ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      title: z.string().describe("发布评审标题 (必填)"),
      release_id: z.string().optional().describe('发布计划ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      description: z.string().optional().describe("详细描述"),
      owner: z.string().optional().describe("负责人（默认当前用户）"),
      creator: z.string().optional().describe("创建人（默认当前用户）"),
      custom_field_one: z.string().optional().describe("自定义字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        owner: params.owner ?? nickName,
        creator: params.creator ?? nickName,
      };
      return client.post("/launch_forms", finalParams);
    },
  },
  {
    name: "tapd_get_launch_forms_activity_logs",
    description: "获取发布评审日志",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('日志ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      launch_id: z.string().optional().describe('发布评审ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      user: z.string().optional().describe("操作人"),
      action: z.string().optional().describe("操作类型"),
      created: z.string().optional().describe("创建时间"),
      limit: z.number().optional().describe("返回数量，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/launch_forms/activity_logs", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_launch_forms_count",
    description: "获取发布评审数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('发布评审ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      title: z.string().optional().describe("标题"),
      status: z.string().optional().describe("状态"),
      creator: z.string().optional().describe("创建人"),
      owner: z.string().optional().describe("负责人"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/launch_forms/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_launch_forms_custom_fields_settings",
    description: "获取发布评审自定义字段",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/launch_forms/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_launch_forms_templates",
    description: "获取发布评审模板",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('模板ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/launch_forms/templates", { ...params, workspace_id: workspaceId });
    },
  },
];
