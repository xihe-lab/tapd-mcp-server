import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const commentTools: ToolDef[] = [
  {
    name: "tapd_get_comments",
    description: "Get comments from TAPD for stories, bugs, or tasks",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      entry_type: z.string().optional().describe("Entity type: story, bug, or task"),
      entry_id: z.string().optional().describe("Entity ID to get comments for"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/comments", params);
    },
  },
  {
    name: "tapd_create_comment",
    description: "Create a new comment on a story, bug, or task",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      entry_type: z.string().describe("Entity type: story, bug, or task"),
      entry_id: z.string().describe("Entity ID to comment on"),
      comment: z.string().describe("Comment content"),
      cc: z.string().optional().describe("Copy to users, separated by |"),
      attachments: z.string().optional().describe("Attachment file IDs, separated by |"),
    }),
    handler: async (client, params) => {
      return client.post("/comments", params);
    },
  },
];
