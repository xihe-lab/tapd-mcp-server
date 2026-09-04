import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const userTools: ToolDef[] = [
  {
    name: "tapd_get_personal_setting",
    description: "Get personal settings for the current user",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      nick: z.string().describe("用户唯一标识 (必填)"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/users/get_personal_setting", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_roles",
    description: "Get role list for a workspace",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/roles", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_third_user_mapping",
    description: "获取第三方用户映射",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      third_type: z.string().optional().describe("第三方类型"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/users/third_user_mapping", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_current_user",
    description: "获取当前认证用户的信息",
    inputSchema: z.object({}),
    handler: async (client: TapdClient) => {
      return client.get("/users/info");
    },
  },
];
