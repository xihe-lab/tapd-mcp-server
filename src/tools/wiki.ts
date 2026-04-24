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
      return client.get("/tapd_wikis", params);
    },
  },
  {
    name: "tapd_create_wiki",
    description: "Create a new wiki page in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      name: z.string().describe("Wiki page title"),
      creator: z.string().optional().describe("Creator name (defaults to TAPD_NICK_NAME env)"),
      description: z.string().optional().describe("Rich text content"),
      markdown_description: z.string().optional().describe("Markdown content"),
      note: z.string().optional().describe("Note/remark"),
      parent_wiki_id: z.string().optional().describe("Parent wiki ID for nested pages"),
    }),
    handler: async (client, params) => {
      const creator = params.creator ?? process.env.TAPD_NICK_NAME;
      if (!creator) {
        throw new Error("creator is required. Set TAPD_NICK_NAME environment variable or provide creator parameter.");
      }
      return client.post("/tapd_wikis", {
        ...params,
        creator,
      });
    },
  },
];
