import path from 'node:path';
import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';
import { findMentions } from '../richtext/index.js';
import { htmlToMd, mdToHtml } from '../richtext/pipeline.js';
import { mediaTools } from './media.js';

const mdToHtmlSchema = z.object({
  content: z.string().describe('Markdown 内容'),
  upload_images: z.boolean().optional().default(false).describe('显式副作用（默认 false）：扫描 md 中 `![]()` 的本地存在图片路径并逐个上传 TAPD 图床，替换为 /tfl/ 远端路径；返回 uploaded_images 清单（失败项列入 failed_images，不影响其余内容）。上传语义为图片资源创建，不计入实体写闸门（FSD §3.4，side_effect: upload）'),
  workspace_id: z.number().optional().describe('项目ID：提供时对 `@昵称` 做成员校验（调 tapd_get_workspace_users；接口 403/失败自动降级跳过并在 warnings 说明），未命中昵称列入 warnings；同时作为 upload_images 的上传项目（省略时取默认项目配置）'),
});

const htmlToMdSchema = z.object({
  html: z.string().describe('TAPD 富文本 HTML（description/comment 等）'),
});

/**
 * md 内 `![]()` 图片目的地扫描（支持 `<包角>` 与可选标题）。
 * 每次调用新建正则实例，避免全局正则 lastIndex 状态串扰。
 */
function imageMdRe(): RegExp {
  return /!\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s\n]+)(?:\s+"[^"\n]*")?\s*\)/g;
}

/**
 * 判定图片目的地是否可能为本地路径（需 upload 后再由存在性检查裁决）：
 * scheme（http:/https:/attach:/data:...）、锚点、协议相对地址、TAPD 图床 /tfl/ 保留前缀排除；
 * 其余（含 macOS/Linux 绝对路径与相对路径）交由上传 handler 的 existsSync 判定，
 * 不存在的路径进 failed_images 原样保留（绝不猜测改写）。
 */
function isLocalPathCandidate(dest: string): boolean {
  if (dest === '') return false;
  if (dest.startsWith('#') || dest.startsWith('//')) return false;
  if (dest.startsWith('/tfl/')) return false; // TAPD 图床远端路径（上传后的产物，不再二次上传）
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(dest);
}

function unwrapAngleDest(dest: string): string {
  return dest.startsWith('<') && dest.endsWith('>') ? dest.slice(1, -1) : dest;
}

interface UploadedImage { local_path: string; image_src: string }
interface FailedImage { local_path: string; reason: string }

/** FSD §3.4：md 本地图 → 上传（复用 tapd_upload_image handler，函数组合）→ /tfl/ 路径替换。 */
async function uploadLocalImages(
  client: TapdClient,
  content: string,
  workspaceId: number,
): Promise<{ content: string; uploaded: UploadedImage[]; failed: FailedImage[] }> {
  const uploadImage = mediaTools.find(t => t.name === 'tapd_upload_image');
  if (!uploadImage) throw new Error('tapd_upload_image tool is not available for upload_images');
  const uploaded: UploadedImage[] = [];
  const failed: FailedImage[] = [];
  const srcByDest = new Map<string, string>();
  const srcByResolved = new Map<string, string>(); // 去重：同一文件的不同写法只上传一次

  const dests = new Set<string>();
  for (const match of content.matchAll(imageMdRe())) {
    const dest = unwrapAngleDest(match[2]);
    if (isLocalPathCandidate(dest)) dests.add(dest);
  }
  for (const dest of dests) {
    const resolvedKey = path.resolve(dest);
    const reused = srcByResolved.get(resolvedKey);
    if (reused) {
      srcByDest.set(dest, reused);
      continue;
    }
    try {
      const result = await uploadImage.handler(client, { workspace_id: workspaceId, image_path: dest }) as { image_src: string };
      if (typeof result?.image_src === 'string' && result.image_src !== '') {
        srcByDest.set(dest, result.image_src);
        srcByResolved.set(resolvedKey, result.image_src);
        uploaded.push({ local_path: dest, image_src: result.image_src });
      } else {
        failed.push({ local_path: dest, reason: 'upload returned no image_src' });
      }
    } catch (error) {
      failed.push({ local_path: dest, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  if (uploaded.length > 0) {
    content = content.replace(imageMdRe(), (whole, alt: string, dest: string) => {
      const src = srcByDest.get(unwrapAngleDest(dest));
      return src ? `![${alt}](${src})` : whole;
    });
  }
  return { content, uploaded, failed };
}

function extractNicknames(payload: unknown): Set<string> {
  const names = new Set<string>();
  for (const item of Array.isArray(payload) ? payload : []) {
    if (typeof item === 'string' && item !== '') {
      names.add(item);
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const user = (rec.User as Record<string, unknown> | undefined)?.user ?? rec.user;
      if (typeof user === 'string' && user !== '') names.add(user);
    }
  }
  return names;
}

/** FSD §3.6：昵称成员校验（尽力而为；403/失败降级跳过——R4 服务端仍智能识别，欠标记无害）。 */
async function validateMentionNicknames(
  client: TapdClient,
  workspaceId: number,
  content: string,
): Promise<string[]> {
  let known: Set<string>;
  try {
    const payload = await client.get<unknown>('/users', { workspace_id: workspaceId, fields: 'user' });
    known = extractNicknames(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [`成员校验已跳过（tapd_get_workspace_users 不可用：${reason.slice(0, 120)}）；@昵称 仍由服务端智能识别`];
  }
  if (known.size === 0) {
    return ['成员校验已跳过（成员列表为空或无权限读取）；@昵称 仍由服务端智能识别'];
  }
  const misses = [...new Set(findMentions(content).map(m => m.name))].filter(name => !known.has(name));
  return misses.map(name => `@${name} 未命中项目成员昵称（请核对昵称拼写；关键通知场景建议同时填 cc）`);
}

const mdToHtmlHandler = async (client: TapdClient, params: z.infer<typeof mdToHtmlSchema>) => {
  let content = params.content;
  let uploaded: UploadedImage[] = [];
  let failed: FailedImage[] = [];
  if (params.upload_images) {
    const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
    if (!workspaceId) {
      throw new Error('workspace_id is required for upload_images (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
    }
    ({ content, uploaded, failed } = await uploadLocalImages(client, content, workspaceId));
  }
  let warnings: string[] = [];
  if (params.workspace_id !== undefined) {
    warnings = await validateMentionNicknames(client, params.workspace_id, content);
  }
  return {
    html: mdToHtml(content),
    ...(uploaded.length > 0 ? { uploaded_images: uploaded } : {}),
    ...(failed.length > 0 ? { failed_images: failed } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

// eslint-disable-next-line @typescript-eslint/require-await
const htmlToMdHandler = async (_client: TapdClient, params: z.infer<typeof htmlToMdSchema>) => {
  return { markdown: htmlToMd(params.html) };
};

const shortToLongIdSchema = z.object({
  short_id: z.string().describe('短 ID（纯数字，≤9 位）；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
  workspace_id: z.union([z.string(), z.number()]).describe('项目 ID'),
  is_cloud: z.boolean().optional().default(true).describe('是否云环境（默认 true）'),
});

// eslint-disable-next-line @typescript-eslint/require-await
const shortToLongIdHandler = async (_client: TapdClient, params: z.infer<typeof shortToLongIdSchema>) => {
  const result = TapdClient.toLongId(params.short_id, params.workspace_id, params.is_cloud);
  return {
    short_id: params.short_id,
    workspace_id: params.workspace_id,
    long_id: result,
    is_converted: result !== params.short_id,
  };
};

/**
 * Run promises with limited concurrency
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });
    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const p = executing[i];
        const settled = await Promise.race([p, Promise.resolve('pending')]);
        if (settled !== 'pending') {
          void executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

const batchFetchStoriesSchema = z.object({
  ids: z.array(z.string()).describe('需求 ID 列表（支持短 ID 和长 ID）'),
  workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
  fields: z.string().optional().describe('返回字段'),
  max_workers: z.number().optional().default(3).describe('最大并发数（默认 3）'),
});

const batchFetchBugsSchema = z.object({
  ids: z.array(z.string()).describe('缺陷 ID 列表（支持短 ID 和长 ID）'),
  workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
  fields: z.string().optional().describe('返回字段'),
  max_workers: z.number().optional().default(3).describe('最大并发数（默认 3）'),
});

const batchFetchTasksSchema = z.object({
  ids: z.array(z.string()).describe('任务 ID 列表（支持短 ID 和长 ID）'),
  workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
  fields: z.string().optional().describe('返回字段'),
  max_workers: z.number().optional().default(3).describe('最大并发数（默认 3）'),
});

export const utilityTools: ToolDef[] = [
  {
    name: 'tapd_md_to_html',
    description: '将 Markdown 转为 TAPD 富文本 HTML（description/comment 字段专用），模型产 md 省 token，先转再传。支持 TAPD 扩展语法：@昵称 → at-who 提及（@@ 为字面 @ 转义）、[📎 文件名](attach:<ws>/<id>) → 附件锚点；代码段/链接 URL 内的 @ 不误伤。upload_images=true 时把 md 中本地存在的图片路径上传图床并替换为 /tfl/（显式副作用，默认关闭）；workspace_id 提供时校验 @昵称 是否项目成员（不可用时降级跳过）。',
    inputSchema: mdToHtmlSchema,
    handler: mdToHtmlHandler,
    side_effect: 'upload',
  },
  {
    name: 'tapd_html_to_md',
    description: '将 TAPD 富文本 HTML 转为 Markdown（读取 description/comment 后消费专用），HTML 转 md 省 input token。at-who 提及还原为 @昵称（不降级为粗体）、附件锚点还原为 [📎 文件名](attach:<ws>/<id>)、图片还原为 ![](/tfl/...)。',
    inputSchema: htmlToMdSchema,
    handler: htmlToMdHandler,
  },
  {
    name: 'tapd_short_to_long_id',
    description: '将短 ID 转换为长 ID。规则：纯数字且 ≤9 位视为短 ID，云环境前缀 "11"，补零到 9 位拼接 workspace_id。',
    inputSchema: shortToLongIdSchema,
    handler: shortToLongIdHandler,
  },
  {
    name: 'tapd_batch_fetch_stories',
    description: '批量并发获取多个需求详情。支持短 ID 自动转换，默认并发数为 3。',
    inputSchema: batchFetchStoriesSchema,
    handler: async (client: TapdClient, params: z.infer<typeof batchFetchStoriesSchema>) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }

      const maxConcurrency = params.max_workers ?? 3;
      const tasks = params.ids.map(id => () => {
        const longId = TapdClient.toLongId(id, workspaceId);
        return client.get('/stories', {
          workspace_id: workspaceId,
          id: longId,
          ...(params.fields ? { fields: params.fields } : {}),
        });
      });

      return runWithConcurrency(tasks, maxConcurrency);
    },
  },
  {
    name: 'tapd_batch_fetch_bugs',
    description: '批量并发获取多个缺陷详情。支持短 ID 自动转换，默认并发数为 3。',
    inputSchema: batchFetchBugsSchema,
    handler: async (client: TapdClient, params: z.infer<typeof batchFetchBugsSchema>) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }

      const maxConcurrency = params.max_workers ?? 3;
      const tasks = params.ids.map(id => () => {
        const longId = TapdClient.toLongId(id, workspaceId);
        return client.get('/bugs', {
          workspace_id: workspaceId,
          id: longId,
          ...(params.fields ? { fields: params.fields } : {}),
        });
      });

      return runWithConcurrency(tasks, maxConcurrency);
    },
  },
  {
    name: 'tapd_batch_fetch_tasks',
    description: '批量并发获取多个任务详情。支持短 ID 自动转换，默认并发数为 3。',
    inputSchema: batchFetchTasksSchema,
    handler: async (client: TapdClient, params: z.infer<typeof batchFetchTasksSchema>) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }

      const maxConcurrency = params.max_workers ?? 3;
      const tasks = params.ids.map(id => () => {
        const longId = TapdClient.toLongId(id, workspaceId);
        return client.get('/tasks', {
          workspace_id: workspaceId,
          id: longId,
          ...(params.fields ? { fields: params.fields } : {}),
        });
      });

      return runWithConcurrency(tasks, maxConcurrency);
    },
  },
];