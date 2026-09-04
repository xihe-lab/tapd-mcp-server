import { z } from 'zod';
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

const markdownIt = new MarkdownIt({ html: false, breaks: true });

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndown.use(gfm);

const mdToHtmlSchema = z.object({
  content: z.string().describe('Markdown 内容'),
});

const htmlToMdSchema = z.object({
  html: z.string().describe('TAPD 富文本 HTML（description/comment 等）'),
});

// eslint-disable-next-line @typescript-eslint/require-await
const mdToHtmlHandler = async (_client: TapdClient, params: z.infer<typeof mdToHtmlSchema>) => {
  return { html: markdownIt.render(params.content) };
};

// eslint-disable-next-line @typescript-eslint/require-await
const htmlToMdHandler = async (_client: TapdClient, params: z.infer<typeof htmlToMdSchema>) => {
  return { markdown: turndown.turndown(params.html) };
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
    description: '将 Markdown 转为 TAPD 富文本 HTML（description/comment 字段专用），模型产 md 省 token，先转再传。',
    inputSchema: mdToHtmlSchema,
    handler: mdToHtmlHandler,
  },
  {
    name: 'tapd_html_to_md',
    description: '将 TAPD 富文本 HTML 转为 Markdown（读取 description/comment 后消费专用），HTML 转 md 省 input token。',
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