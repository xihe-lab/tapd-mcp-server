import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const miniCommentTools: ToolDef[] = [
  {
    name: 'tapd_mini_get_comments',
    description: 'Get comments from mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Comment ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entry_id: z.string().optional().describe('Item ID the comment belongs to；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      author: z.string().optional().describe('Comment author'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
      root_id: z.string().optional().describe('Root comment ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      reply_id: z.string().optional().describe('Reply comment ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order, e.g., "created desc"'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/comments', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_mini_create_comment',
    description: 'Create a comment in mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      entry_id: z.string().describe('Item ID the comment belongs to (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      description: z.string().describe('Comment content (required, wrap with <p> tags)'),
      author: z.string().optional().describe('Comment author (defaults to TAPD_NICK_NAME env)'),
      root_id: z.string().optional().describe('Root comment ID (for replies)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      reply_id: z.string().optional().describe('Reply comment ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        author: params.author ?? nickName,
      };
      return client.post('/comments', finalParams);
    },
  },
  {
    name: 'tapd_mini_get_comment_count',
    description: 'Get the count of comments in mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Comment ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entry_id: z.string().optional().describe('Item ID the comment belongs to；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      author: z.string().optional().describe('Comment author'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/comments/count', { ...params, workspace_id: workspaceId });
    },
  },
];
