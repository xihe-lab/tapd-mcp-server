import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const changeTools: ToolDef[] = [
  {
    name: "tapd_get_story_changes",
    description: "Get story change history",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().optional().describe("Story ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/story_changes", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_story_changes_count",
    description: "Get the count of story changes",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().optional().describe("Story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/story_changes/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_task_changes",
    description: "Get task change history",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      task_id: z.string().optional().describe("Task ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/task_changes", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_task_changes_count",
    description: "Get the count of task changes",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      task_id: z.string().optional().describe("Task ID"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/task_changes/count", { ...params, workspace_id: workspaceId });
    },
  },
];
