import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const miniItemTools: ToolDef[] = [
  {
    name: 'tapd_mini_get_items',
    description: 'Get mini workspace items (轻协作工作项)',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Item ID, supports multiple IDs'),
      name: z.string().optional().describe('Item title, supports fuzzy matching'),
      priority: z.string().optional().describe('Priority, supports enum query'),
      status: z.string().optional().describe('Status (open/done), supports enum query'),
      label: z.string().optional().describe('Label, supports enum query'),
      owner: z.string().optional().describe('Owner, supports fuzzy matching'),
      creator: z.string().optional().describe('Creator, supports multiple users query'),
      is_archived: z.boolean().optional().describe('Is archived'),
      begin: z.string().optional().describe('Estimated start date, supports time query'),
      due: z.string().optional().describe('Estimated end date, supports time query'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
      completed: z.string().optional().describe('Completion time, supports time query'),
      progress_manual: z.number().optional().describe('Progress'),
      category_id: z.string().optional().describe('Category ID, supports enum query (-1 for uncategorized)'),
      parent_id: z.string().optional().describe('Parent item ID'),
      children_id: z.string().optional().describe('Child item ID'),
      description: z.string().optional().describe('Description, supports fuzzy matching'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order, e.g., "created desc"'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      return client.get('/mini_items', params);
    },
  },
  {
    name: 'tapd_mini_create_item',
    description: 'Create a new item in mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      name: z.string().describe('Item title (required)'),
      priority: z.string().optional().describe('Priority'),
      owner: z.string().optional().describe('Owner'),
      creator: z.string().optional().describe('Creator (defaults to TAPD_NICK_NAME env)'),
      is_archived: z.boolean().optional().describe('Is archived'),
      begin: z.string().optional().describe('Estimated start date (YYYY-MM-DD)'),
      due: z.string().optional().describe('Estimated end date (YYYY-MM-DD)'),
      parent_id: z.string().optional().describe('Parent item ID'),
      category_id: z.string().optional().describe('Category ID'),
      description: z.string().optional().describe('Description'),
      label: z.string().optional().describe('Labels, separated by |'),
    }),
    handler: async (client, params) => {
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        creator: params.creator ?? nickName,
      };
      return client.post('/mini_items', finalParams);
    },
  },
  {
    name: 'tapd_mini_update_item',
    description: 'Update an existing item in mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().describe('Item ID (required)'),
      name: z.string().optional().describe('Item title'),
      priority: z.string().optional().describe('Priority'),
      owner: z.string().optional().describe('Owner'),
      is_archived: z.boolean().optional().describe('Is archived'),
      begin: z.string().optional().describe('Estimated start date (YYYY-MM-DD)'),
      due: z.string().optional().describe('Estimated end date (YYYY-MM-DD)'),
      parent_id: z.string().optional().describe('Parent item ID'),
      category_id: z.string().optional().describe('Category ID'),
      description: z.string().optional().describe('Description'),
      label: z.string().optional().describe('Labels, separated by |'),
      status: z.string().optional().describe('Status (open/done)'),
      progress_manual: z.number().optional().describe('Progress'),
    }),
    handler: async (client, params) => {
      return client.post('/mini_items/update', params);
    },
  },
  {
    name: 'tapd_mini_get_item_count',
    description: 'Get the count of mini workspace items',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Item ID, supports multiple IDs'),
      name: z.string().optional().describe('Item title, supports fuzzy matching'),
      priority: z.string().optional().describe('Priority, supports enum query'),
      status: z.string().optional().describe('Status (open/done), supports enum query'),
      label: z.string().optional().describe('Label, supports enum query'),
      owner: z.string().optional().describe('Owner, supports fuzzy matching'),
      creator: z.string().optional().describe('Creator, supports multiple users query'),
      is_archived: z.boolean().optional().describe('Is archived'),
      begin: z.string().optional().describe('Estimated start date, supports time query'),
      due: z.string().optional().describe('Estimated end date, supports time query'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
      completed: z.string().optional().describe('Completion time, supports time query'),
      category_id: z.string().optional().describe('Category ID, supports enum query'),
    }),
    handler: async (client, params) => {
      return client.get('/mini_items/count', params);
    },
  },
  {
    name: 'tapd_mini_get_categories',
    description: 'Get mini workspace item categories',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Category ID'),
      name: z.string().optional().describe('Category name'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
    }),
    handler: async (client, params) => {
      return client.get('/mini_item_categories', params);
    },
  },
  {
    name: 'tapd_mini_get_changes',
    description: 'Get mini workspace item changes/history',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
      id: z.string().optional().describe('Change ID'),
      item_id: z.string().optional().describe('Item ID'),
      created: z.string().optional().describe('Creation time, supports time query'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      return client.get('/mini_item_changes', params);
    },
  },
];