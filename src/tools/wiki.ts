import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const wikiTools: ToolDef[] = [
  {
    name: "tapd_get_wikis",
    description: "Get wiki pages from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      id: z.string().optional().describe("Wiki ID, supports multiple IDs"),
      name: z.string().optional().describe("Wiki page name, supports fuzzy matching"),
      creator: z.string().optional().describe("Creator name"),
      modifier: z.string().optional().describe("Last modifier name"),
      status: z.string().optional().describe("Status of the wiki page"),
      category_id: z.string().optional().describe("Category ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/wikis", params);
    },
  },
];
