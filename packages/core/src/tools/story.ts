import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const storyTools: ToolDef[] = [
  // 需求 CRUD
  {
    name: 'tapd_get_stories',
    description: '获取需求列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('需求ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('需求标题，支持模糊匹配'),
      priority: z.string().optional().describe('优先级'),
      priority_label: z.string().optional().describe('优先级标签（推荐）'),
      status: z.string().optional().describe('状态'),
      v_status: z.string().optional().describe('状态（中文）'),
      with_v_status: z.string().optional().describe('设为1返回中文状态'),
      label: z.string().optional().describe('标签'),
      workitem_type_id: z.string().optional().describe('需求类别ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      owner: z.string().optional().describe('处理人，支持模糊匹配'),
      creator: z.string().optional().describe('创建人'),
      developer: z.string().optional().describe('开发人员'),
      cc: z.string().optional().describe('抄送人'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      include_sub_iteration: z.string().optional().describe('包含子迭代：0或1'),
      category_id: z.string().optional().describe('需求分类；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      include_sub_category: z.string().optional().describe('包含子分类：0或1'),
      parent_id: z.string().optional().describe('父需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      ancestor_id: z.string().optional().describe('祖先需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      children_id: z.string().optional().describe('子需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      begin: z.string().optional().describe('预计开始日期 YYYY-MM-DD'),
      due: z.string().optional().describe('预计结束日期 YYYY-MM-DD'),
      created: z.string().optional().describe('创建时间 YYYY-MM-DD HH:mm'),
      modified: z.string().optional().describe('修改时间'),
      completed: z.string().optional().describe('完成时间'),
      effort: z.string().optional().describe('预估工时'),
      effort_completed: z.string().optional().describe('完成工时'),
      remain: z.number().optional().describe('剩余工时'),
      exceed: z.number().optional().describe('超出工时'),
      release_id: z.string().optional().describe('发布计划；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      module: z.string().optional().describe('模块'),
      feature: z.string().optional().describe('特性'),
      version: z.string().optional().describe('版本'),
      source: z.string().optional().describe('需求来源'),
      type: z.string().optional().describe('需求类型'),
      description: z.string().optional().describe('详细描述'),
      custom_field_one: z.string().optional().describe('自定义字段 (支持1-200)'),
      limit: z.number().optional().describe('返回数量，默认30'),
      page: z.number().optional().describe('页码，默认1'),
      order: z.string().optional().describe('排序'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        id: params.id ? TapdClient.toLongId(params.id, workspaceId) : undefined,
        workspace_id: workspaceId,
      };
      return client.get('/stories', convertedParams);
    },
  },
  {
    name: 'tapd_create_story',
    description: '创建需求（也可创建任务：传入 workitem_type_id 为 TASK 类型 ID 即可创建任务，适合仅有 stories::create 权限而无 tasks::create 权限的场景）',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe('需求标题 (必填)'),
      description: z.string().optional().describe('详细描述'),
      priority: z.string().optional().describe('优先级'),
      priority_label: z.string().optional().describe('优先级标签（推荐）'),
      owner: z.string().optional().describe('处理人（默认当前用户）'),
      creator: z.string().optional().describe('创建人（默认当前用户）'),
      developer: z.string().optional().describe('开发人员'),
      cc: z.string().optional().describe('抄送人'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      category_id: z.string().optional().describe('需求分类；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      parent_id: z.string().optional().describe('父需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      begin: z.string().optional().describe('预计开始日期 YYYY-MM-DD'),
      due: z.string().optional().describe('预计结束日期 YYYY-MM-DD'),
      effort: z.string().optional().describe('预估工时'),
      release_id: z.string().optional().describe('发布计划；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      module: z.string().optional().describe('模块'),
      feature: z.string().optional().describe('特性'),
      version: z.string().optional().describe('版本'),
      source: z.string().optional().describe('需求来源'),
      type: z.string().optional().describe('需求类型'),
      label: z.string().optional().describe('标签'),
      template_id: z.string().optional().describe('模板ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      business_value: z.string().optional().describe('业务价值'),
      test_focus: z.string().optional().describe('测试关注点'),
      size: z.string().optional().describe('规模/大小'),
      custom_field_one: z.string().optional().describe('自定义字段'),
      workitem_type_id: z.string().optional().describe('工作项类型ID（可选，默认创建需求；传入 TASK 类型 ID 可创建任务。可通过 tapd_get_workitem_types 查询可用类型）；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const nickName = TapdClient.getNickName();
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }

      // Resolve workitem_type_id: user param > env default > auto-detect via API
      let workitemTypeId = params.workitem_type_id
        ?? TapdClient.getDefaultStoryWorkitemTypeId();

      if (!workitemTypeId) {
        const response = await client.get<{ WorkitemType: { id: string; english_name: string } }[]>(
          '/workitem_types',
          { workspace_id: workspaceId }
        );
        const types = response ?? [];
        const storyType = types.find(item =>
          item.WorkitemType?.english_name === 'STORY'
        );
        if (storyType) {
          workitemTypeId = storyType.WorkitemType.id;
        }
      }

      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        workitem_type_id: workitemTypeId,
        owner: params.owner ?? nickName,
        creator: params.creator ?? nickName,
      };
      return client.post('/stories', finalParams);
    },
  },
  {
    name: 'tapd_update_story',
    description: '更新需求',
    inputSchema: z.object({
      id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe('需求标题'),
      description: z.string().optional().describe('详细描述'),
      status: z.string().optional().describe('状态'),
      owner: z.string().optional().describe('处理人'),
      priority: z.string().optional().describe('优先级'),
      priority_label: z.string().optional().describe('优先级标签'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      category_id: z.string().optional().describe('需求分类；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      begin: z.string().optional().describe('预计开始日期'),
      due: z.string().optional().describe('预计结束日期'),
      effort: z.string().optional().describe('预估工时'),
      effort_completed: z.string().optional().describe('已完成工时'),
      remain: z.number().optional().describe('剩余工时'),
      exceed: z.number().optional().describe('超出工时'),
      business_value: z.string().optional().describe('业务价值'),
      test_focus: z.string().optional().describe('测试关注点'),
      size: z.string().optional().describe('规模'),
      current_user: z.string().optional().describe('操作人'),
      custom_field_one: z.string().optional().describe('自定义字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        id: TapdClient.toLongId(params.id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/stories', convertedParams);
    },
  },
  {
    name: 'tapd_get_story_count',
    description: '获取需求数量',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('需求标题'),
      priority: z.string().optional().describe('优先级'),
      priority_label: z.string().optional().describe('优先级标签（推荐）'),
      status: z.string().optional().describe('状态'),
      owner: z.string().optional().describe('处理人'),
      creator: z.string().optional().describe('创建人'),
      developer: z.string().optional().describe('开发人员'),
      cc: z.string().optional().describe('抄送人'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      category_id: z.string().optional().describe('需求分类；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      parent_id: z.string().optional().describe('父需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      ancestor_id: z.string().optional().describe('祖先需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      begin: z.string().optional().describe('预计开始日期'),
      due: z.string().optional().describe('预计结束日期'),
      created: z.string().optional().describe('创建时间'),
      modified: z.string().optional().describe('修改时间'),
      completed: z.string().optional().describe('完成时间'),
      release_id: z.string().optional().describe('发布计划；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      module: z.string().optional().describe('模块'),
      feature: z.string().optional().describe('特性'),
      version: z.string().optional().describe('版本'),
      source: z.string().optional().describe('需求来源'),
      type: z.string().optional().describe('需求类型'),
      label: z.string().optional().describe('标签'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/count', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_copy_story',
    description: '复制需求',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('要复制的需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('新需求标题（默认为原标题）'),
      owner: z.string().optional().describe('处理人'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      copy_attachments: z.number().optional().describe('是否复制附件，值=1复制'),
      copy_comments: z.number().optional().describe('是否复制评论，值=1复制'),
      copy_sub_tasks: z.number().optional().describe('是否复制子任务，值=1复制'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        id: TapdClient.toLongId(params.id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/stories/copy', convertedParams);
    },
  },
  {
    name: 'tapd_batch_update_stories',
    description: '批量更新需求',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      stories: z.string().describe('需求更新数组JSON，最多50条 (必填)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post('/stories/batch_update', { ...params, workspace_id: workspaceId });
    },
  },
  // 需求分类
  {
    name: 'tapd_get_story_categories',
    description: '获取需求分类列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('分类ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('分类名称，支持模糊匹配'),
      parent_id: z.string().optional().describe('父分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      created: z.string().optional().describe('创建时间'),
      modified: z.string().optional().describe('修改时间'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      order: z.string().optional().describe('排序'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/story_categories', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_story_categories_count',
    description: '获取需求分类数量',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('分类名称'),
      parent_id: z.string().optional().describe('父分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/story_categories/count', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_add_story_category',
    description: '创建需求分类',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe('分类名称 (必填)'),
      parent_id: z.string().optional().describe('父分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post('/story_categories/add', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_update_story_category',
    description: '更新需求分类',
    inputSchema: z.object({
      id: z.string().describe('分类ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe('分类名称'),
      parent_id: z.string().optional().describe('父分类ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post('/story_categories/update', { ...params, workspace_id: workspaceId });
    },
  },
  // 需求类别
  {
    name: 'tapd_get_workitem_types',
    description: '获取需求类别列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/workitem_types', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_change_workitem_type',
    description: '更新需求类别',
    inputSchema: z.object({
      id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      workitem_type_id: z.string().describe('新的需求类别ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        id: TapdClient.toLongId(params.id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/stories/change_workitem_type', convertedParams);
    },
  },
  // 字段配置
  {
    name: 'tapd_get_story_fields_info',
    description: '获取需求字段信息',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      workitem_type_id: z.string().optional().describe('需求类别ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/fields_info', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_story_fields_lable',
    description: '获取需求字段中英文映射',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/fields_lable', { ...params, workspace_id: workspaceId });
    },
  },
  // 模板
  {
    name: 'tapd_get_story_template_list',
    description: '获取需求模板列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      workitem_type_id: z.string().optional().describe('需求类别ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/templates', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_default_story_template',
    description: '获取需求默认模板',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      workitem_type_id: z.string().optional().describe('需求类别ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/default_template', { ...params, workspace_id: workspaceId });
    },
  },
  // 关联关系
  {
    name: 'tapd_get_story_related_bugs',
    description: '获取需求关联的缺陷',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: TapdClient.toLongId(params.story_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.get('/stories/related_bugs', convertedParams);
    },
  },
  {
    name: 'tapd_create_story_bug',
    description: '创建需求缺陷关联',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      bug_id: z.string().describe('缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: TapdClient.toLongId(params.story_id, workspaceId),
        bug_id: TapdClient.toLongId(params.bug_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/stories/create_story_bug', convertedParams);
    },
  },
  {
    name: 'tapd_remove_story_bug_relations',
    description: '解除需求缺陷关联',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      bug_id: z.string().describe('缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: TapdClient.toLongId(params.story_id, workspaceId),
        bug_id: TapdClient.toLongId(params.bug_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/stories/remove_story_bug_relations', convertedParams);
    },
  },
  {
    name: 'tapd_get_story_tcase',
    description: '获取需求测试用例关联',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      tcase_id: z.string().optional().describe('测试用例ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: TapdClient.toLongId(params.story_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.get('/stories/story_tcase', convertedParams);
    },
  },
  {
    name: 'tapd_create_story_tcase',
    description: '创建需求测试用例关联',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      tcase_id: z.string().describe('测试用例ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: TapdClient.toLongId(params.story_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/stories/create_story_tcase', convertedParams);
    },
  },
  // 前后置关系
  {
    name: 'tapd_get_time_relative_stories',
    description: '获取需求前后置关系',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().optional().describe('需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      predecessor_id: z.string().optional().describe('前置需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      successor_id: z.string().optional().describe('后置需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      relation_type: z.string().optional().describe('关系类型'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: params.story_id ? TapdClient.toLongId(params.story_id, workspaceId) : undefined,
        predecessor_id: params.predecessor_id ? TapdClient.toLongId(params.predecessor_id, workspaceId) : undefined,
        successor_id: params.successor_id ? TapdClient.toLongId(params.successor_id, workspaceId) : undefined,
        workspace_id: workspaceId,
      };
      return client.get('/stories/time_relative_stories', convertedParams);
    },
  },
  {
    name: 'tapd_save_time_relations',
    description: '批量新增/修改前后置关系',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      relations: z.string().describe('前后置关系数组JSON (必填)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post('/stories/save_time_relations', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_delete_time_relations',
    description: '批量删除前后置关系',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      relations: z.string().describe('要删除的前后置关系数组JSON (必填)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post('/stories/delete_time_relations', { ...params, workspace_id: workspaceId });
    },
  },
  // 其他
  {
    name: 'tapd_get_removed_stories',
    description: '获取回收站的需求',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('需求ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('标题'),
      owner: z.string().optional().describe('处理人'),
      creator: z.string().optional().describe('创建人'),
      created: z.string().optional().describe('创建时间'),
      deleted: z.string().optional().describe('删除时间'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      order: z.string().optional().describe('排序'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/removed', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_update_story_parent',
    description: '更新父需求',
    inputSchema: z.object({
      id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      parent_id: z.string().describe('新的父需求ID (必填)，设为0取消父子关系；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      // parent_id can be "0" to cancel relationship, only convert if not "0"
      const convertedParams = {
        ...params,
        id: TapdClient.toLongId(params.id, workspaceId),
        parent_id: params.parent_id !== '0' ? TapdClient.toLongId(params.parent_id, workspaceId) : params.parent_id,
        workspace_id: workspaceId,
      };
      return client.post('/stories/update_parent', convertedParams);
    },
  },
  {
    name: 'tapd_get_stories_by_view_conf_id',
    description: '获取视图需求列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      view_conf_id: z.string().describe('视图配置ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/stories/by_view_conf_id', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_story_steps',
    description: '获取需求节点信息',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      story_id: z.string().describe('需求ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        story_id: TapdClient.toLongId(params.story_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.get('/stories/steps', convertedParams);
    },
  },
];