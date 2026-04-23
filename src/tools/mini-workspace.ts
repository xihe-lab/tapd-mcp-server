import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const miniWorkspaceTools: ToolDef[] = [
  {
    name: 'tapd_mini_get_workspace_info',
    description: 'Get mini workspace information',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
    }),
    handler: async (client, params) => {
      return client.get('/workspaces/get_workspace_info', params);
    },
  },
  {
    name: 'tapd_mini_get_workspace_users',
    description: 'Get mini workspace members list',
    inputSchema: z.object({
      workspace_id: z.number().describe('Mini workspace ID (required)'),
    }),
    handler: async (client, params) => {
      return client.get('/workspaces/users', params);
    },
  },
  {
    name: 'tapd_mini_get_user_projects',
    description: 'Get all mini workspaces user participates in',
    inputSchema: z.object({
      // This API doesn't require workspace_id, it returns all user's mini workspaces
    }),
    handler: async (client, params) => {
      return client.get('/mini_projects/get_mini_project_list_with_permission', params);
    },
  },
];