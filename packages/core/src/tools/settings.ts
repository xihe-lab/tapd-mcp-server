import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const settingsTools: ToolDef[] = [
  // 模块 CRUD
  {
    name: "tapd_get_modules",
    description: "获取项目模块列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('模块ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("模块名称，支持模糊匹配"),
      description: z.string().optional().describe("模块描述"),
      owner: z.string().optional().describe("模块负责人"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则，如 created desc"),
      fields: z.string().optional().describe("返回字段，多个字段以逗号分隔"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/modules", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_module",
    description: "创建项目模块",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("模块名称 (必填)"),
      description: z.string().optional().describe("模块描述"),
      owner: z.string().optional().describe("模块负责人"),
      parent_id: z.string().optional().describe("父模块ID（用于创建子模块）；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/modules/add", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_module",
    description: "更新项目模块",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('模块ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("模块名称"),
      description: z.string().optional().describe("模块描述"),
      owner: z.string().optional().describe("模块负责人"),
      parent_id: z.string().optional().describe("父模块ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/modules/update", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_modules_count",
    description: "获取模块数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('模块ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("模块名称"),
      owner: z.string().optional().describe("模块负责人"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/modules/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 版本 CRUD
  {
    name: "tapd_get_versions",
    description: "获取项目版本列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('版本ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("版本名称，支持模糊匹配"),
      owner: z.string().optional().describe("版本负责人"),
      creator: z.string().optional().describe("创建人"),
      status: z.string().optional().describe("状态：0为未关闭，1为已关闭"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30"),
      page: z.number().optional().describe("页码，默认1"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/versions", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_version",
    description: "创建项目版本",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("版本名称 (必填)"),
      description: z.string().optional().describe("版本描述"),
      owner: z.string().optional().describe("版本负责人"),
      release_date: z.string().optional().describe("发布日期，格式: YYYY-MM-DD"),
      status: z.number().optional().describe("状态：0-未发布（默认），1-已发布"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/versions/add", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_version",
    description: "更新项目版本",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('版本ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("版本名称"),
      description: z.string().optional().describe("版本描述"),
      owner: z.string().optional().describe("版本负责人"),
      release_date: z.string().optional().describe("发布日期"),
      status: z.number().optional().describe("状态：0-未发布，1-已发布"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/versions/update", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_versions_count",
    description: "获取版本数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('版本ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("版本名称"),
      owner: z.string().optional().describe("版本负责人"),
      status: z.number().optional().describe("状态"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/versions/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 特性 CRUD
  {
    name: "tapd_get_features",
    description: "获取项目特性列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('特性ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("特性名称，支持模糊匹配"),
      description: z.string().optional().describe("特性描述"),
      owner: z.string().optional().describe("特性负责人"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/features", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_feature",
    description: "创建项目特性",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("特性名称 (必填)"),
      description: z.string().optional().describe("特性描述"),
      owner: z.string().optional().describe("特性负责人"),
      parent_id: z.string().optional().describe("父特性ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/features/add", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_feature",
    description: "更新项目特性",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('特性ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("特性名称"),
      description: z.string().optional().describe("特性描述"),
      owner: z.string().optional().describe("特性负责人"),
      parent_id: z.string().optional().describe("父特性ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/features/update", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_features_count",
    description: "获取特性数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('特性ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("特性名称"),
      owner: z.string().optional().describe("特性负责人"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/features/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 基线 CRUD
  {
    name: "tapd_get_baselines",
    description: "获取项目基线列表",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('基线ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("基线名称，支持模糊匹配"),
      description: z.string().optional().describe("基线描述"),
      baseline_date: z.string().optional().describe("基线日期，支持时间查询"),
      created: z.string().optional().describe("创建时间，支持时间查询"),
      limit: z.number().optional().describe("返回数量限制，默认30"),
      page: z.number().optional().describe("页码，默认1"),
      order: z.string().optional().describe("排序规则"),
      fields: z.string().optional().describe("返回字段"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/baselines", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_add_baseline",
    description: "创建项目基线",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("基线名称 (必填)"),
      description: z.string().optional().describe("基线描述"),
      baseline_date: z.string().optional().describe("基线日期，格式: YYYY-MM-DD"),
      version: z.string().optional().describe("关联版本"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/baselines/add", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_baseline",
    description: "更新项目基线",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('基线ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("基线名称"),
      description: z.string().optional().describe("基线描述"),
      baseline_date: z.string().optional().describe("基线日期"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/baselines/update", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_baselines_count",
    description: "获取基线数量",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('基线ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("基线名称"),
      baseline_date: z.string().optional().describe("基线日期"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/baselines/count", { ...params, workspace_id: workspaceId });
    },
  },
  // 自定义字段配置
  {
    name: "tapd_add_custom_field_config",
    description: "创建自定义字段",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("自定义字段名称 (必填)"),
      type: z.string().describe("字段类型 (必填): single_select/multi_select/text/date/integer/float/cascade/user"),
      entity_type: z.string().describe("适用实体类型 (必填): story/bug"),
      options: z.string().optional().describe("候选值选项（单选/多选类型必填），多个以|分隔"),
      default_value: z.string().optional().describe("默认值"),
      required: z.number().optional().describe("是否必填：0-否，1-是，默认0"),
      description: z.string().optional().describe("字段描述"),
      workitem_type_id: z.string().optional().describe('需求类别ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/add_custom_field_config", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_bug_select_field_options",
    description: "更新缺陷下拉类型自定义字段候选值",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      custom_field_key: z.string().describe("自定义字段标识 (必填)，如 custom_field_one"),
      options: z.string().describe("新的候选值选项 (必填)，多个以|分隔"),
      append_mode: z.number().optional().describe("追加模式：0-替换（默认），1-追加"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/update_bug_select_field_options", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_story_select_field_options",
    description: "更新需求下拉类型自定义字段候选值",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      custom_field_key: z.string().describe("自定义字段标识 (必填)，如 custom_field_one"),
      options: z.string().describe("新的候选值选项 (必填)，多个以|分隔"),
      workitem_type_id: z.string().optional().describe('需求类别ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      append_mode: z.number().optional().describe("追加模式：0-替换（默认），1-追加"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/update_story_select_field_options", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_cascade_field_options",
    description: "更新级联自定义字段候选值",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      custom_field_key: z.string().describe("自定义字段标识 (必填)"),
      cascade_options: z.string().describe("级联选项JSON格式 (必填)"),
      entity_type: z.string().optional().describe("实体类型: story/bug"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/settings/update_cascade_field_options", { ...params, workspace_id: workspaceId });
    },
  },
  // 项目配置
  {
    name: "tapd_get_workspace_setting",
    description: "获取项目配置开关",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/settings/workspace_setting", { ...params, workspace_id: workspaceId });
    },
  },
];
