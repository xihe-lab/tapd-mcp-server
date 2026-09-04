import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const attachmentTools: ToolDef[] = [
  // Standard TAPD API attachment tools
  {
    name: 'tapd_get_attachments',
    description: 'Get attachment list from TAPD',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Attachment ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_id: z.string().optional().describe('Related entity ID (story/task/bug/wiki ID)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_type: z.string().optional().describe('Entity type (story, task, bug, wiki)'),
      filename: z.string().optional().describe('Filename'),
      owner: z.string().optional().describe('Uploader'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
      limit: z.number().optional().describe('Number of results to return, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order, e.g., "created desc"'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_attachment',
    description: 'Get a single attachment from TAPD',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments/get_one', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_attachment_download_url',
    description: 'Get download URL for a single attachment (valid for 300s)',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      filename: z.string().optional().describe('Filename for download'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments/documents_down', { ...params, workspace_id: workspaceId });
    },
  },
  // Mini (轻协作) API attachment tools
  {
    name: 'tapd_mini_get_attachments',
    description: 'Get attachments from mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Attachment ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entry_id: z.string().optional().describe('Item ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      filename: z.string().optional().describe('Filename'),
      owner: z.string().optional().describe('Uploader'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_mini_get_attachment_download_url',
    description: 'Get download URL for a single mini workspace attachment (valid for 300s)',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments/down', { ...params, workspace_id: workspaceId });
    },
  },
];