import { z } from 'zod';
import type { ToolDef } from '../types.js';
import type { TapdClient } from '../tapd-client.js';

export const workspaceTools: ToolDef[] = [
  {
    name: "tapd_get_workspace_info",
    description: "Get TAPD workspace/project info by ID",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/workspaces/get_workspace_info", params);
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
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/workspaces/get_workspace_users", params);
    },
  },
];
