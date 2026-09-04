import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const customFieldTools: ToolDef[] = [
  {
    name: "tapd_get_story_custom_fields",
    description: "Get story custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      workitem_type_id: z.string().optional().describe('Work item type ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/stories/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_bug_custom_fields",
    description: "Get bug custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      workitem_type_id: z.string().optional().describe('Work item type ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/bugs/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_task_custom_fields",
    description: "Get task custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tasks/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_case_custom_fields",
    description: "Get test case custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_iteration_custom_fields",
    description: "Get iteration custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/iterations/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_task_fields_info",
    description: "Get task fields information",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tasks/get_fields_info", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_case_fields_info",
    description: "Get test case fields information",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases/get_fields_info", { ...params, workspace_id: workspaceId });
    },
  },
];
