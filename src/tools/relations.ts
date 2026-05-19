import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const relationTools: ToolDef[] = [
  {
    name: "tapd_get_link_stories",
    description: "Get linked stories for a story",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe("Story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/stories/get_link_stories", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_related_bugs",
    description: "Get related bugs for a story",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe("Story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/stories/get_related_bugs", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_story_link_relation",
    description: "Add story link relation",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      source_story_id: z.string().describe("Source story ID"),
      target_story_id: z.string().describe("Target story ID"),
      link_type: z.string().optional().describe("Link type"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/stories/add_story_link_relations", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_remove_story_link_relation",
    description: "Remove story link relation",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      source_story_id: z.string().describe("Source story ID"),
      target_story_id: z.string().describe("Target story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/stories/remove_story_link_relation", { ...params, workspace_id: workspaceId });
    },
  },
];
