import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const testTools: ToolDef[] = [
  // 测试用例 CRUD
  {
    name: "tapd_create_test_case",
    description: "创建测试用例",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("测试用例名称 (必填)"),
      category_id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      priority: z.string().optional().describe("优先级"),
      status: z.string().optional().describe("状态: updating/abandon/normal"),
      description: z.string().optional().describe("描述"),
      teststeps: z.string().optional().describe("测试步骤"),
      expectresult: z.string().optional().describe("预期结果"),
      precondition: z.string().optional().describe("前置条件"),
      type: z.string().optional().describe("用例类型"),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      owner: z.string().optional().describe("负责人"),
      creator: z.string().optional().describe("创建人（默认当前用户）"),
      custom_field_one: z.string().optional().describe("自定义字段 (支持 1-200)"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        creator: params.creator ?? nickName,
      };
      return client.post("/tcases", finalParams);
    },
  },
  {
    name: "tapd_get_test_cases",
    description: "获取测试用例列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('测试用例ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("测试用例名称，支持模糊匹配"),
      status: z.string().optional().describe("状态: updating/abandon/normal"),
      priority: z.string().optional().describe("优先级"),
      category_id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      creator: z.string().optional().describe("创建人"),
      owner: z.string().optional().describe("负责人"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      modified: z.string().optional().describe("修改时间，支持时间查询"),
      custom_field_one: z.string().optional().describe("自定义字段"),
      limit: z.number().optional().describe("返回数量，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_cases_count",
    description: "获取测试用例数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('测试用例ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("测试用例名称"),
      status: z.string().optional().describe("状态"),
      priority: z.string().optional().describe("优先级"),
      category_id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      creator: z.string().optional().describe("创建人"),
      owner: z.string().optional().describe("负责人"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_test_case",
    description: "更新测试用例",
    inputSchema: z.object({
      id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe("测试用例名称"),
      status: z.string().optional().describe("状态"),
      priority: z.string().optional().describe("优先级"),
      category_id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      description: z.string().optional().describe("描述"),
      teststeps: z.string().optional().describe("测试步骤"),
      expectresult: z.string().optional().describe("预期结果"),
      precondition: z.string().optional().describe("前置条件"),
      type: z.string().optional().describe("用例类型"),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      owner: z.string().optional().describe("负责人"),
      custom_field_one: z.string().optional().describe("自定义字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/tcases", { ...params, workspace_id: workspaceId });
    },
  },
  // 测试用例分类
  {
    name: "tapd_get_tcase_categories",
    description: "获取测试用例分类列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('分类ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("分类名称，支持模糊匹配"),
      parent_id: z.string().optional().describe("父分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      created: z.string().optional().describe("创建时间"),
      modified: z.string().optional().describe("修改时间"),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      order: z.string().optional().describe("排序"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcase_categories", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_tcase_categories_count",
    description: "获取测试用例分类数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("分类名称"),
      parent_id: z.string().optional().describe("父分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcase_categories/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_tcase_category",
    description: "创建测试用例分类",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("分类名称 (必填)"),
      parent_id: z.string().optional().describe("父分类ID（用于创建子分类）；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/tcase_categories", { ...params, workspace_id: workspaceId });
    },
  },
  // 测试用例配置
  {
    name: "tapd_get_tcase_custom_fields_settings",
    description: "获取测试用例自定义字段配置",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases/custom_fields_settings", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_tcase_fields_info",
    description: "获取测试用例字段信息",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases/get_fields_info", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_story_by_tcase_id",
    description: "获取测试用例关联的需求",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      tcase_id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcases/get_story_by_tcase_id", { ...params, workspace_id: workspaceId });
    },
  },
  // 测试用例执行
  {
    name: "tapd_assign_tcase_instance",
    description: "分配测试用例执行人",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      tcase_id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      owner: z.string().describe("分配的执行人 (必填)"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/tcase_instance/assign", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_execute_tcase_instance",
    description: "执行测试用例",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      tcase_id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      result: z.string().describe("执行结果 (必填): pass/fail/block"),
      run_step: z.string().optional().describe("执行步骤结果（JSON格式）"),
      actual_result: z.string().optional().describe("实际结果"),
      bug_id: z.string().optional().describe('关联缺陷ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      executed_by: z.string().optional().describe("执行人（默认当前用户）"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/tcase_instance/execute", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_tcase_result",
    description: "获取测试用例执行结果",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      tcase_id: z.string().optional().describe('测试用例ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      test_plan_id: z.string().optional().describe('测试计划ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      result: z.string().optional().describe("执行结果: pass/fail/block"),
      executed_by: z.string().optional().describe("执行人"),
      executed: z.string().optional().describe("执行时间"),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tcase_instance/result", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_remove_tcase_instance",
    description: "测试用例移出测试计划",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      tcase_id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/tcase_instance/remove_tcase", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_delete_tcase_story_relation",
    description: "解除测试用例与需求关联",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      tcase_id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/tcase_instance/delete_tcase_story_relation", { ...params, workspace_id: workspaceId });
    },
  },
  // 测试计划 CRUD
  {
    name: "tapd_get_test_plans",
    description: "获取测试计划列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('测试计划ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("测试计划名称，支持模糊匹配"),
      status: z.string().optional().describe("状态"),
      creator: z.string().optional().describe("创建人"),
      owner: z.string().optional().describe("负责人"),
      begin: z.string().optional().describe("开始日期"),
      end: z.string().optional().describe("结束日期"),
      created: z.string().optional().describe("创建时间"),
      modified: z.string().optional().describe("修改时间"),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe("返回数量，默认30，最大200"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_test_plan",
    description: "创建测试计划",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("测试计划名称 (必填)"),
      description: z.string().optional().describe("描述"),
      owner: z.string().optional().describe("负责人（默认当前用户）"),
      creator: z.string().optional().describe("创建人（默认当前用户）"),
      begin: z.string().optional().describe("开始日期 (YYYY-MM-DD)"),
      end: z.string().optional().describe("结束日期 (YYYY-MM-DD)"),
      status: z.string().optional().describe("状态"),
      category_id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        owner: params.owner ?? nickName,
        creator: params.creator ?? nickName,
      };
      return client.post("/test_plans", finalParams);
    },
  },
  {
    name: "tapd_update_test_plan",
    description: "更新测试计划",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("测试计划名称"),
      description: z.string().optional().describe("描述"),
      owner: z.string().optional().describe("负责人"),
      begin: z.string().optional().describe("开始日期 (YYYY-MM-DD)"),
      end: z.string().optional().describe("结束日期 (YYYY-MM-DD)"),
      status: z.string().optional().describe("状态"),
      category_id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/test_plans", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_plan_count",
    description: "获取测试计划数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('测试计划ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("测试计划名称"),
      status: z.string().optional().describe("状态"),
      creator: z.string().optional().describe("创建人"),
      owner: z.string().optional().describe("负责人"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 测试计划详情
  {
    name: "tapd_get_test_plan_details",
    description: "获取测试计划测试结果详情",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/details", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_plan_progress",
    description: "获取测试计划执行进度",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/progress", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_plan_fields_info",
    description: "获取测试计划字段信息",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/get_fields_info", { ...params, workspace_id: workspaceId });
    },
  },
  // 测试计划关联
  {
    name: "tapd_get_test_plan_tcases",
    description: "获取测试计划关联的测试用例",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      tcase_id: z.string().optional().describe('测试用例ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/get_test_plan_tcase", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_plan_relative_stories",
    description: "获取测试计划关联的需求",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/get_relative_stories", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_test_plan_bugs",
    description: "获取测试计划关联的缺陷",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe("返回数量"),
      page: z.number().optional().describe("页码"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/test_plans/result_relation_bugs", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_story_relation",
    description: "创建测试计划与需求关联",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/test_plans/create_story_relation", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_delete_story_relation",
    description: "解除测试计划与需求关联",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/test_plans/delete_story_relation", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_tcase_relation",
    description: "创建测试计划与测试用例关联",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      test_plan_id: z.string().describe('测试计划ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      tcase_id: z.string().describe('测试用例ID (必填)，支持多个ID逗号分隔；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/test_plans/create_tcase_relation", { ...params, workspace_id: workspaceId });
    },
  },
];
