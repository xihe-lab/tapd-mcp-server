import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const imageTools: ToolDef[] = [
  {
    name: 'tapd_get_image_url',
    description: '将 TAPD 图片相对路径转换为临时下载 URL（有效期 300s）。用于需求描述中的 /tfl/ 图片路径。',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      image_path: z.string().describe('图片相对路径，如 /tfl/captures/2025/04/xxx.png'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/files/get_image', {
        workspace_id: workspaceId,
        image_path: params.image_path,
      });
    },
  },
];