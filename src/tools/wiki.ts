import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

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
    handler: async (client: TapdClient, params) => {
      return client.callSdk('getWikis', params);
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
    handler: async (client: TapdClient, params) => {
      const creator = params.creator ?? process.env.TAPD_NICK_NAME;
      if (!creator) {
        throw new Error("creator is required. Set TAPD_NICK_NAME environment variable or provide creator parameter.");
      }
      return client.callSdk('addWiki', {
        ...params,
        creator,
      });
    },
  },
  {
    name: "tapd_update_wiki",
    description: "Update an existing wiki page in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      id: z.string().describe("Wiki ID (required)"),
      name: z.string().optional().describe("Wiki page title"),
      modifier: z.string().optional().describe("Modifier name (defaults to TAPD_NICK_NAME env)"),
      description: z.string().optional().describe("Rich text content"),
      markdown_description: z.string().optional().describe("Markdown content"),
      note: z.string().optional().describe("Note/remark"),
      parent_wiki_id: z.string().optional().describe("Parent wiki ID for nested pages"),
    }),
    handler: async (client: TapdClient, params) => {
      const modifier = params.modifier ?? process.env.TAPD_NICK_NAME;
      if (!modifier) {
        throw new Error("modifier is required. Set TAPD_NICK_NAME environment variable or provide modifier parameter.");
      }
      return client.callSdk('updateWiki', {
        ...params,
        modifier,
      });
    },
  },
  {
    name: "tapd_get_wiki_count",
    description: "Get the count of wiki pages matching filters",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      id: z.string().optional().describe("Wiki ID, supports multiple IDs"),
      name: z.string().optional().describe("Wiki page name, supports fuzzy matching"),
      creator: z.string().optional().describe("Creator name"),
      modifier: z.string().optional().describe("Last modifier name"),
      status: z.string().optional().describe("Status of the wiki page"),
      category_id: z.string().optional().describe("Category ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.callSdk('getWikisCount', params);
    },
  },
  {
    name: "tapd_get_wiki_attachments_count",
    description: "Get the count of wiki attachments",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      wiki_id: z.string().optional().describe("Wiki ID"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis_attachments/count", params);
    },
  },
  {
    name: "tapd_get_wiki_drawios",
    description: "Get DrawIO data from wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      id: z.string().optional().describe("Wiki ID"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis_drawios", params);
    },
  },
  {
    name: "tapd_get_wiki_entity_permissions",
    description: "Get entity permissions of wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      id: z.string().optional().describe("Wiki ID"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis_entity_permissions", params);
    },
  },
  {
    name: "tapd_get_wiki_followers",
    description: "Get followers of wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      wiki_id: z.string().optional().describe("Wiki ID"),
      user: z.string().optional().describe("User name"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis_followers", params);
    },
  },
  {
    name: "tapd_get_wiki_followers_count",
    description: "Get the count of wiki followers",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      wiki_id: z.string().optional().describe("Wiki ID"),
      user: z.string().optional().describe("User name"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis/followers_count", params);
    },
  },
  {
    name: "tapd_get_wiki_tags",
    description: "Get tags of wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      wiki_id: z.string().optional().describe("Wiki ID"),
      name: z.string().optional().describe("Tag name"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis_tags", params);
    },
  },
  {
    name: "tapd_get_wiki_tags_count",
    description: "Get the count of wiki tags",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      wiki_id: z.string().optional().describe("Wiki ID"),
      name: z.string().optional().describe("Tag name"),
    }),
    handler: async (client, params) => {
      return client.get("/tapd_wikis_tags/count", params);
    },
  },
];
