import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const settingsTools: ToolDef[] = [
  {
    name: "tapd_get_modules",
    description: "Get module settings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/settings/modules", params);
    },
  },
  {
    name: "tapd_get_versions",
    description: "Get version settings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/settings/versions", params);
    },
  },
  {
    name: "tapd_get_features",
    description: "Get feature settings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/settings/features", params);
    },
  },
];
