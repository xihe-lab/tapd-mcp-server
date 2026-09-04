import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const taskTools: ToolDef[] = [
  {
    name: 'tapd_get_tasks',
    description: 'Query TAPD tasks with filters',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('Task title, supports fuzzy matching'),
      description: z.string().optional().describe('Detailed description'),
      status: z.string().optional().describe('Status, supports enum query'),
      label: z.string().optional().describe('Label, supports enum query'),
      owner: z.string().optional().describe('Owner, supports fuzzy matching'),
      creator: z.string().optional().describe('Creator, supports multiple users query'),
      cc: z.string().optional().describe('CC person'),
      priority: z.string().optional().describe('Priority, recommend using priority_label'),
      priority_label: z.string().optional().describe('Priority (recommended)'),
      story_id: z.string().optional().describe('Related story ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('Iteration ID, supports enum query；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      progress: z.number().optional().describe('Progress'),
      effort: z.string().optional().describe('Estimated effort'),
      effort_completed: z.string().optional().describe('Completed effort'),
      remain: z.number().optional().describe('Remaining effort'),
      exceed: z.number().optional().describe('Exceeded effort'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      created: z.string().optional().describe('Creation time, Format: YYYY-MM-DD HH:mm'),
      modified: z.string().optional().describe('Modification time, Format: YYYY-MM-DD HH:mm'),
      completed: z.string().optional().describe('Completion time, Format: YYYY-MM-DD HH:mm'),
      custom_field_one: z.string().optional().describe('Custom field 1 (supports 1-200)'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order'),
      fields: z.string().optional().describe('Specify return fields'),
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
      return client.get('/tasks', convertedParams);
    },
  },
  {
    name: 'tapd_create_task',
    description: 'Create a new task in TAPD',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe('Task name'),
      description: z.string().optional().describe('Detailed description'),
      owner: z.string().optional().describe('Owner (defaults to TAPD_NICK_NAME env)'),
      creator: z.string().optional().describe('Creator'),
      cc: z.string().optional().describe('CC person'),
      priority: z.string().optional().describe('Priority'),
      priority_label: z.string().optional().describe('Priority label (recommended)'),
      story_id: z.string().optional().describe('Related story ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('Iteration ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      status: z.string().optional().describe('Status (open, progressing, done)'),
      progress: z.number().optional().describe('Progress'),
      effort: z.string().optional().describe('Estimated effort'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      label: z.string().optional().describe('Label'),
      custom_field_one: z.string().optional().describe('Custom field 1 (supports 1-200)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        story_id: params.story_id ? TapdClient.toLongId(params.story_id, workspaceId) : undefined,
        workspace_id: workspaceId,
        owner: params.owner ?? nickName,
        creator: params.creator ?? nickName,
      };
      return client.post('/tasks', finalParams);
    },
  },
  {
    name: 'tapd_update_task',
    description: 'Update an existing task in TAPD',
    inputSchema: z.object({
      id: z.string().describe('Task ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().optional().describe('Task name'),
      description: z.string().optional().describe('Detailed description'),
      owner: z.string().optional().describe('Owner'),
      cc: z.string().optional().describe('CC person'),
      priority: z.string().optional().describe('Priority'),
      priority_label: z.string().optional().describe('Priority label (recommended)'),
      story_id: z.string().optional().describe('Related story ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('Iteration ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      status: z.string().optional().describe('Status (open, progressing, done)'),
      progress: z.number().optional().describe('Progress'),
      effort: z.string().optional().describe('Estimated effort'),
      effort_completed: z.string().optional().describe('Completed effort'),
      remain: z.number().optional().describe('Remaining effort'),
      exceed: z.number().optional().describe('Exceeded effort'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      label: z.string().optional().describe('Label'),
      current_user: z.string().optional().describe('Operator user (for update)'),
      auto_complete_effort: z.number().optional().describe('Auto complete effort when status changes to done (value=1)'),
      custom_field_one: z.string().optional().describe('Custom field 1 (supports 1-200)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        id: TapdClient.toLongId(params.id, workspaceId),
        story_id: params.story_id ? TapdClient.toLongId(params.story_id, workspaceId) : undefined,
        workspace_id: workspaceId,
      };
      return client.post('/tasks', convertedParams);
    },
  },
  {
    name: 'tapd_get_task_count',
    description: 'Get the count of tasks matching filters',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('Task title, supports fuzzy matching'),
      description: z.string().optional().describe('Detailed description'),
      status: z.string().optional().describe('Status, supports enum query'),
      label: z.string().optional().describe('Label, supports enum query'),
      owner: z.string().optional().describe('Owner, supports fuzzy matching'),
      creator: z.string().optional().describe('Creator, supports multiple users query'),
      cc: z.string().optional().describe('CC person'),
      priority: z.string().optional().describe('Priority, recommend using priority_label'),
      priority_label: z.string().optional().describe('Priority (recommended)'),
      story_id: z.string().optional().describe('Related story ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      iteration_id: z.string().optional().describe('Iteration ID, supports enum query；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      progress: z.number().optional().describe('Progress'),
      effort: z.string().optional().describe('Estimated effort'),
      effort_completed: z.string().optional().describe('Completed effort'),
      remain: z.number().optional().describe('Remaining effort'),
      exceed: z.number().optional().describe('Exceeded effort'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      created: z.string().optional().describe('Creation time, Format: YYYY-MM-DD HH:mm'),
      modified: z.string().optional().describe('Modification time, Format: YYYY-MM-DD HH:mm'),
      completed: z.string().optional().describe('Completion time, Format: YYYY-MM-DD HH:mm'),
      custom_field_one: z.string().optional().describe('Custom field 1 (supports 1-200)'),
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
      return client.get('/tasks/count', convertedParams);
    },
  },
  {
    name: 'tapd_batch_update_tasks',
    description: 'Batch update multiple tasks in TAPD (supports updating story_id)',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      tasks: z.array(z.object({
        id: z.string().describe('Task ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
        name: z.string().optional().describe('Task name'),
        description: z.string().optional().describe('Detailed description'),
        owner: z.string().optional().describe('Owner'),
        cc: z.string().optional().describe('CC person'),
        priority: z.string().optional().describe('Priority'),
        priority_label: z.string().optional().describe('Priority label (recommended)'),
        story_id: z.string().optional().describe('Related story ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
        iteration_id: z.string().optional().describe('Iteration ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
        status: z.string().optional().describe('Status (open, progressing, done)'),
        progress: z.number().optional().describe('Progress'),
        effort: z.string().optional().describe('Estimated effort'),
        begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
        due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
        label: z.string().optional().describe('Label'),
        custom_field_one: z.string().optional().describe('Custom field 1 (supports 1-200)'),
      })).describe('Array of tasks to update (max 50 per request)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      // TAPD API expects workitems as a JSON string
      // Convert task IDs and story_ids in the array
      const tasks = params.tasks as ({ id: string } & Record<string, string | number | undefined>)[];
      const workitems = tasks.map((task) => {
        const { id, story_id, ...rest } = task;
        return {
          id: TapdClient.toLongId(id, workspaceId),
          story_id: story_id ? TapdClient.toLongId(story_id, workspaceId) : undefined,
          ...rest,
        };
      });
      const workitemsJson = JSON.stringify(workitems);
      return client.post('/tasks/batch_update_task', {
        workspace_id: workspaceId,
        workitems: workitemsJson,
      });
    },
  },
  // 其他
  {
    name: 'tapd_get_removed_tasks',
    description: '获取回收站的任务',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('任务ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe('标题'),
      owner: z.string().optional().describe('处理人'),
      creator: z.string().optional().describe('创建人'),
      created: z.string().optional().describe('创建时间'),
      deleted: z.string().optional().describe('删除时间'),
      limit: z.number().optional().describe('返回数量，默认30，最大200'),
      page: z.number().optional().describe('页码'),
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
      return client.get('/tasks/removed', convertedParams);
    },
  },
  {
    name: 'tapd_get_tasks_by_view_conf_id',
    description: '获取视图任务列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      view_conf_id: z.string().describe('视图配置ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      limit: z.number().optional().describe('返回数量，默认30，最大200'),
      page: z.number().optional().describe('页码，默认1'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/tasks/by_view_conf_id', { ...params, workspace_id: workspaceId });
    },
  },
];
