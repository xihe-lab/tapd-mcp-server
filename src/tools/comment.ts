import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const commentTools: ToolDef[] = [
  {
    name: "tapd_get_comments",
    description: "Get comments from TAPD for stories, bugs, or tasks",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe("Comment ID, supports multiple IDs"),
      entry_type: z.string().optional().describe("Entity type: story, bug, or task"),
      entry_id: z.string().optional().describe("Entity ID to get comments for"),
      author: z.string().optional().describe("Comment author"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Last modified time, supports time query"),
      reply_id: z.string().optional().describe("Reply comment ID"),
      root_id: z.string().optional().describe("Root comment ID for replies"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/comments", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_comment",
    description: "Create a new comment on a story, bug, or task",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      entry_type: z.string().describe("Entity type: bug, bug_remark, stories, or tasks"),
      entry_id: z.string().describe("Entity ID to comment on"),
      description: z.string().describe("Comment content"),
      author: z.string().optional().describe("Author (defaults to TAPD_NICK_NAME env)"),
      cc: z.string().optional().describe("Copy to users, separated by |"),
      attachments: z.string().optional().describe("Attachment file IDs, separated by |"),
      root_id: z.string().optional().describe("Root comment ID for replies"),
      reply_id: z.string().optional().describe("Comment ID being replied to"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        author: params.author ?? TapdClient.getNickName(),
      };
      return client.post("/comments", finalParams);
    },
  },
  {
    name: "tapd_get_comments_count",
    description: "获取评论数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      entry_type: z.string().optional().describe("对象类型: story, bug, or task"),
      entry_id: z.string().optional().describe("对象ID"),
      author: z.string().optional().describe("评论作者"),
      created: z.string().optional().describe("创建时间"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/comments/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_comment",
    description: "更新评论",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe("评论ID (必填)"),
      description: z.string().optional().describe("评论内容"),
      author: z.string().optional().describe("作者"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/comments", { ...params, workspace_id: workspaceId });
    },
  },
];
