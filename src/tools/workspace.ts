import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const workspaceTools: ToolDef[] = [
  {
    name: "tapd_get_workspace_info",
    description: "Get TAPD workspace/project info by ID",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workspaces/get_workspace_info", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_projects",
    description: "Get all projects under a company",
    inputSchema: z.object({
      company_id: z.number().describe("Company ID"),
      category: z.string().optional().describe("Project type: project/mini_project"),
      with_extends: z.number().optional().describe("Set to 1 to return custom fields"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/workspaces/projects", params);
    },
  },
  {
    name: "tapd_get_user_projects",
    description: "Get projects a user participates in",
    inputSchema: z.object({
      nick: z.string().describe("Member nickname"),
      company_id: z.number().describe("Company ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/workspaces/user_participant_projects", params);
    },
  },
  {
    name: "tapd_get_workspace_users",
    description: "Get all users in a workspace",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      fields: z.string().optional().describe("需要查的字段值: user,role_id,email,tof_id 可选，以,分隔"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/users", { ...params, workspace_id: workspaceId });
    },
  },
  // 自定义字段
  {
    name: "tapd_get_workspace_custom_fields",
    description: "获取项目自定义字段配置",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workspaces/custom_fields", { ...params, workspace_id: workspaceId });
    },
  },
  // 子项目
  {
    name: "tapd_get_sub_workspaces",
    description: "获取子项目列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workspaces/sub_workspaces", { ...params, workspace_id: workspaceId });
    },
  },
  // 文档
  {
    name: "tapd_get_workspace_documents",
    description: "获取项目文档列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workspaces/documents", { ...params, workspace_id: workspaceId });
    },
  },
  // 日历
  {
    name: "tapd_get_workspace_calendar",
    description: "获取项目日历信息",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      start_date: z.string().optional().describe("开始日期 YYYY-MM-DD"),
      end_date: z.string().optional().describe("结束日期 YYYY-MM-DD"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workspaces/calendar", { ...params, workspace_id: workspaceId });
    },
  },
  // 第三方项目
  {
    name: "tapd_get_third_projects",
    description: "获取第三方项目关联",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workspaces/third_projects", { ...params, workspace_id: workspaceId });
    },
  },
];
