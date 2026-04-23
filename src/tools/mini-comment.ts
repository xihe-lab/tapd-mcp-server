import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const miniCommentTools: ToolDef[] = [
  {
    name: 'tapd_mini_get_comments',
    description: 'Get comments from mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Comment ID, supports multiple IDs'),
      entry_id: z.string().optional().describe('Item ID the comment belongs to'),
      author: z.string().optional().describe('Comment author'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
      root_id: z.string().optional().describe('Root comment ID'),
      reply_id: z.string().optional().describe('Reply comment ID'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order, e.g., "created desc"'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      return client.get('/comments', params);
    },
  },
  {
    name: 'tapd_mini_create_comment',
    description: 'Create a comment in mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      entry_id: z.string().describe('Item ID the comment belongs to (required)'),
      description: z.string().describe('Comment content (required, wrap with <p> tags)'),
      author: z.string().optional().describe('Comment author (defaults to TAPD_NICK_NAME env)'),
      root_id: z.string().optional().describe('Root comment ID (for replies)'),
      reply_id: z.string().optional().describe('Reply comment ID'),
    }),
    handler: async (client, params) => {
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        author: params.author ?? nickName,
      };
      return client.post('/comments', finalParams);
    },
  },
  {
    name: 'tapd_mini_get_comment_count',
    description: 'Get the count of comments in mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Comment ID, supports multiple IDs'),
      entry_id: z.string().optional().describe('Item ID the comment belongs to'),
      author: z.string().optional().describe('Comment author'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
    }),
    handler: async (client, params) => {
      return client.get('/comments/count', params);
    },
  },
];