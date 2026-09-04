import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const iterationTools: ToolDef[] = [
  {
    name: "tapd_get_iterations",
    description: "Get iterations with optional filters",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Iteration ID, supports multi-ID query；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Iteration title, supports fuzzy matching"),
      description: z.string().optional().describe("Iteration description"),
      status: z.string().optional().describe("Status: open/done or custom Chinese status"),
      startdate: z.string().optional().describe("Start date, supports time query"),
      enddate: z.string().optional().describe("End date, supports time query"),
      creator: z.string().optional().describe("Creator"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Modification time, supports time query"),
      completed: z.string().optional().describe("Completion time"),
      workitem_type_id: z.string().optional().describe('Iteration category；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      plan_app_id: z.string().optional().describe('Plan application ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      locker: z.string().optional().describe("Locked by user"),
      custom_field_one: z.string().optional().describe("Custom field 1 (supports 1-200)"),
      limit: z.number().optional().describe("Return count limit, default 30, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order"),
      fields: z.string().optional().describe("Specify return fields"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/iterations", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_iteration",
    description: "Create a new iteration",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("Iteration name"),
      startdate: z.string().optional().describe("Start date"),
      enddate: z.string().optional().describe("End date"),
      description: z.string().optional().describe("Iteration description"),
      status: z.string().optional().describe("Status: open/done"),
      creator: z.string().optional().describe("Creator (defaults to TAPD_NICK_NAME env, required by API)"),
      workitem_type_id: z.string().optional().describe('Iteration category；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      plan_app_id: z.string().optional().describe('Plan application ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_type: z.string().optional().describe("Entity type: iteration or release (default: iteration)"),
      parent_id: z.string().optional().describe('Parent plan ID (for iteration under release)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      label: z.string().optional().describe("Label, multiple labels separated by |"),
      custom_field_one: z.string().optional().describe("Custom field 1 (supports 1-200)"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        creator: params.creator ?? TapdClient.getNickName(),
      };
      return client.post("/iterations", finalParams);
    },
  },
  {
    name: "tapd_update_iteration",
    description: "Update an existing iteration",
    inputSchema: z.object({
      id: z.string().describe('Iteration ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe("Iteration name"),
      startdate: z.string().optional().describe("Start date"),
      enddate: z.string().optional().describe("End date"),
      description: z.string().optional().describe("Iteration description"),
      status: z.string().optional().describe("Status: open/done"),
      label: z.string().optional().describe("Label, multiple labels separated by |"),
      current_user: z.string().optional().describe("Current user for operation (defaults to TAPD_NICK_NAME env, required by API)"),
      workitem_type_id: z.string().optional().describe('Iteration category；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      plan_app_id: z.string().optional().describe('Plan application ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      custom_field_one: z.string().optional().describe("Custom field 1 (supports 1-200)"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        current_user: params.current_user ?? TapdClient.getNickName(),
      };
      return client.post("/iterations", finalParams);
    },
  },
  {
    name: "tapd_get_iteration_count",
    description: "Get count of iterations matching filters",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe("Iteration title, supports fuzzy matching"),
      status: z.string().optional().describe("Status: open/done or custom Chinese status"),
      startdate: z.string().optional().describe("Start date, supports time query"),
      enddate: z.string().optional().describe("End date, supports time query"),
      creator: z.string().optional().describe("Creator"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Modification time, supports time query"),
      completed: z.string().optional().describe("Completion time"),
      workitem_type_id: z.string().optional().describe('Iteration category；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      plan_app_id: z.string().optional().describe('Plan application ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      locker: z.string().optional().describe("Locked by user"),
      custom_field_one: z.string().optional().describe("Custom field 1 (supports 1-200)"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/iterations/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 迭代变更历史
  {
    name: "tapd_get_iteration_changes",
    description: "获取迭代变更历史",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      field: z.string().optional().describe("变更字段"),
      user: z.string().optional().describe("变更人"),
      created: z.string().optional().describe("创建时间"),
      limit: z.number().optional().describe("返回数量，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/iterations/changes", { ...params, workspace_id: workspaceId });
    },
  },
  // 锁定/解锁
  {
    name: "tapd_lock_iteration",
    description: "锁定迭代",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('迭代ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      current_user: z.string().optional().describe("操作人（默认当前用户）"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        current_user: params.current_user ?? TapdClient.getNickName(),
      };
      return client.post("/iterations/lock", finalParams);
    },
  },
  {
    name: "tapd_unlock_iteration",
    description: "解锁迭代",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('迭代ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      current_user: z.string().optional().describe("操作人（默认当前用户）"),
    }),
    handler: async (client: TapdClient, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        current_user: params.current_user ?? TapdClient.getNickName(),
      };
      return client.post("/iterations/unlock", finalParams);
    },
  },
];
