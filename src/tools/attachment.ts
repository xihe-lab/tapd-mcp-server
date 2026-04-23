import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const attachmentTools: ToolDef[] = [
  // Standard TAPD API attachment tools
  {
    name: 'tapd_get_attachments',
    description: 'Get attachment list from TAPD',
    inputSchema: z.object({
      workspace_id: z.number().describe('Project ID (required)'),
      id: z.string().optional().describe('Attachment ID, supports multiple IDs'),
      entity_id: z.string().optional().describe('Related entity ID (story/task/bug/wiki ID)'),
      entity_type: z.string().optional().describe('Entity type (story, task, bug, wiki)'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
      limit: z.number().optional().describe('Number of results to return, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order, e.g., "created desc"'),
    }),
    handler: async (client, params) => {
      return client.get('/attachments', params);
    },
  },
  {
    name: 'tapd_get_attachment',
    description: 'Get a single attachment from TAPD',
    inputSchema: z.object({
      workspace_id: z.number().describe('Project ID (required)'),
      id: z.string().describe('Attachment ID (required)'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      return client.get('/attachments/get_one', params);
    },
  },
  {
    name: 'tapd_get_attachment_download_url',
    description: 'Get download URL for a single attachment (valid for 300s)',
    inputSchema: z.object({
      workspace_id: z.number().describe('Project ID (required)'),
      id: z.string().describe('Attachment ID (required)'),
      filename: z.string().optional().describe('Filename for download'),
    }),
    handler: async (client, params) => {
      return client.get('/attachments/documents_down', params);
    },
  },
  // Mini (轻协作) API attachment tools
  {
    name: 'tapd_mini_get_attachments',
    description: 'Get attachments from mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Attachment ID'),
      entry_id: z.string().optional().describe('Item ID'),
      filename: z.string().optional().describe('Filename'),
      owner: z.string().optional().describe('Uploader'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
    }),
    handler: async (client, params) => {
      return client.get('/attachments', params);
    },
  },
  {
    name: 'tapd_mini_get_attachment_download_url',
    description: 'Get download URL for a single mini workspace attachment (valid for 300s)',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().describe('Attachment ID (required)'),
    }),
    handler: async (client, params) => {
      return client.get('/attachments/down', params);
    },
  },
];