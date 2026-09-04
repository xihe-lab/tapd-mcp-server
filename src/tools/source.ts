import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const sourceTools: ToolDef[] = [
  {
    name: "tapd_add_code_commit_infos",
    description: "新增代码提交记录",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      commit_id: z.string().describe('提交ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      message: z.string().describe("提交信息 (必填)"),
      branch: z.string().optional().describe("分支名"),
      commit_time: z.string().optional().describe("提交时间，格式: YYYY-MM-DD HH:mm:ss"),
      committer: z.string().optional().describe("提交人"),
      files: z.string().optional().describe("提交文件列表，JSON格式"),
      entity_id: z.string().optional().describe('关联实体ID（需求/缺陷/任务）；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_type: z.string().optional().describe("关联实体类型: story/bug/task"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/code_commit_infos/add", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_code_commit_infos",
    description: "获取代码提交记录列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('提交记录ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      commit_id: z.string().optional().describe('提交ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      message: z.string().optional().describe("提交信息，支持模糊匹配"),
      branch: z.string().optional().describe("分支名"),
      committer: z.string().optional().describe("提交人"),
      entity_id: z.string().optional().describe('关联实体ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_type: z.string().optional().describe("关联实体类型: story/bug/task"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则，如 created desc"),
      fields: z.string().optional().describe("指定返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/code_commit_infos", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_commit_objects",
    description: "获取代码提交对象详情",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      commit_id: z.string().describe('提交ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      fields: z.string().optional().describe("指定返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/commit_objects", { ...params, workspace_id: workspaceId });
    },
  },
];
