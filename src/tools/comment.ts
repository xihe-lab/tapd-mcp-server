import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

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
    handler: async (client: TapdClient, params) => {
      return client.callSdk('getComments', params);
    },
  },
  {
    name: "tapd_get_comment_count",
    description: "Get the count of comments",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      entry_type: z.string().optional().describe("Entity type: story, bug, or task"),
      entry_id: z.string().optional().describe("Entity ID to count comments for"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.callSdk('getCommentsCount', params);
    },
  },
  {
    name: "tapd_create_comment",
    description: "Create a new comment on a story, bug, or task",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      entry_type: z.string().describe("Entity type: bug, bug_remark, stories, or tasks"),
      entry_id: z.string().describe("Entity ID to comment on"),
      description: z.string().describe("Comment content"),
      author: z.string().optional().describe("Author (defaults to TAPD_NICK_NAME env)"),
      cc: z.string().optional().describe("Copy to users, separated by |"),
      attachments: z.string().optional().describe("Attachment file IDs, separated by |"),
      root_id: z.string().optional().describe("Root comment ID for replies"),
      reply_id: z.string().optional().describe("Comment ID being replied to"),
    }),
    handler: async (client: TapdClient, params) => {
      const finalParams = {
        ...params,
        author: params.author ?? TapdClient.getNickName(),
      };
      return client.callSdk('addComment', finalParams);
    },
  },
];
