import { z } from 'zod';
import type { ToolDef } from '../types.js';
import type { TapdClient } from '../tapd-client.js';

export const userTools: ToolDef[] = [
  {
    name: "tapd_get_personal_setting",
    description: "Get personal settings for the current user",
    inputSchema: z.object({
      workspace_id: z.number().describe("公司ID (必填)"),
      nick: z.string().describe("用户唯一标识 (必填)"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/users/get_personal_setting", params);
    },
  },
  {
    name: "tapd_get_roles",
    description: "Get role list for a workspace",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/roles", params);
    },
  },
];
