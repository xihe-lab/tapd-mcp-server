import { createReadStream } from 'node:fs';
import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';
import { LARGE_FILE_WARN_BYTES, localFileRefine, resolveLocalFile } from './attachment.js';

/**
 * Rich-media (image) upload tool — FSD §3.4, requirement 1139814312001001547
 * (upload tool part). Returns `image_src` (/tfl/ relative path, rendered by
 * CDN rewrite on the web), `html_code` (paste-ready) and `markdown`
 * (`![image](<image_src>)`, for the md write pipeline).
 */
export const mediaTools: ToolDef[] = [
  {
    name: 'tapd_upload_image',
    description: '上传本地图片到 TAPD 富文本图床。返回 image_src（/tfl/ 相对路径，网页端嵌入即渲染）、html_code（可直接拼入评论/描述富文本）与 markdown（![image](<image_src>)，拼入 md 管道写工具）。读侧配套工具 tapd_get_image_url 可将 /tfl/ 路径换回临时 URL。文件上限 300MB。',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      image_path: z.string().min(1).refine(localFileRefine(), { message: '本地图片不存在（或超过 300MB 上限）' }).describe('本地图片路径（绝对路径，或相对当前工作目录）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const { absolutePath, size } = resolveLocalFile(params.image_path);
      const data = await client.postFile<{ image_src?: string; html_code?: string }>('/files/upload_image', {
        workspace_id: workspaceId,
        image: createReadStream(absolutePath),
      });
      const imageSrc = typeof data?.image_src === 'string' ? data.image_src : undefined;
      if (!imageSrc) {
        throw new Error(`unexpected uploadImage response (no image_src): ${JSON.stringify(data).slice(0, 200)}`);
      }
      return {
        image_src: imageSrc,
        ...(typeof data.html_code === 'string' && data.html_code !== '' ? { html_code: data.html_code } : {}),
        markdown: `![image](${imageSrc})`,
        ...(size > LARGE_FILE_WARN_BYTES
          ? { warning: `image is ${(size / 1024 / 1024).toFixed(1)}MB (>50MB), upload may be slow` }
          : {}),
      };
    },
    cli: { resource: 'image', action: 'upload', positional: 'image_path' },
  },
];
