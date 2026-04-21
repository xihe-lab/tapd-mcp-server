import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const releaseTools: ToolDef[] = [
  {
    name: "tapd_get_releases",
    description: "Get releases from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      id: z.string().optional().describe("Release ID, supports multiple IDs"),
      name: z.string().optional().describe("Release name, supports fuzzy matching"),
      status: z.string().optional().describe("Status of the release"),
      owner: z.string().optional().describe("Owner name"),
      creator: z.string().optional().describe("Creator name"),
      release_date: z.string().optional().describe("Release date"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/releases", params);
    },
  },
];
