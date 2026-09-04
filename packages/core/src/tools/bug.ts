import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const bugTools: ToolDef[] = [
  {
    name: 'tapd_get_bugs',
    description: 'Query TAPD bugs with filters',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      title: z.string().optional().describe('Bug title, supports fuzzy matching'),
      priority: z.string().optional().describe('Priority, recommend using priority_label'),
      priority_label: z.string().optional().describe('Priority (recommended)'),
      severity: z.string().optional().describe('Severity, supports enum query'),
      status: z.string().optional().describe('Status, supports enum query'),
      v_status: z.string().optional().describe('Status (Chinese)'),
      label: z.string().optional().describe('Label, supports enum query'),
      iteration_id: z.string().optional().describe('Iteration ID, supports enum query；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      module: z.string().optional().describe('Module, supports enum query'),
      current_owner: z.string().optional().describe('Current owner, supports fuzzy matching'),
      reporter: z.string().optional().describe('Reporter, supports multiple users query'),
      participator: z.string().optional().describe('Participant, supports multiple users query'),
      te: z.string().optional().describe('Tester, supports fuzzy matching'),
      de: z.string().optional().describe('Developer, supports fuzzy matching'),
      cc: z.string().optional().describe('CC person'),
      created: z.string().optional().describe('Creation time, Format: YYYY-MM-DD HH:mm'),
      in_progress_time: z.string().optional().describe('Accept time, Format: YYYY-MM-DD HH:mm'),
      resolved: z.string().optional().describe('Resolve time, Format: YYYY-MM-DD HH:mm'),
      verify_time: z.string().optional().describe('Verify time, Format: YYYY-MM-DD HH:mm'),
      closed: z.string().optional().describe('Close time, Format: YYYY-MM-DD HH:mm'),
      reject_time: z.string().optional().describe('Reject time, Format: YYYY-MM-DD HH:mm'),
      modified: z.string().optional().describe('Last modification time, Format: YYYY-MM-DD HH:mm'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      deadline: z.string().optional().describe('Resolve deadline, Format: YYYY-MM-DD'),
      release_id: z.string().optional().describe('Release plan；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      version_report: z.string().optional().describe('Found version, enum query'),
      version_test: z.string().optional().describe('Verify version'),
      version_fix: z.string().optional().describe('Fix version'),
      version_close: z.string().optional().describe('Close version'),
      baseline_find: z.string().optional().describe('Found baseline'),
      baseline_join: z.string().optional().describe('Join baseline'),
      baseline_test: z.string().optional().describe('Test baseline'),
      baseline_close: z.string().optional().describe('Close baseline'),
      feature: z.string().optional().describe('Feature'),
      source: z.string().optional().describe('Bug root cause, supports enum query'),
      bugtype: z.string().optional().describe('Bug type'),
      frequency: z.string().optional().describe('Reproduction frequency, supports enum query'),
      originphase: z.string().optional().describe('Found phase'),
      sourcephase: z.string().optional().describe('Introduction phase'),
      resolution: z.string().optional().describe('Resolution method, supports enum query'),
      description: z.string().optional().describe('Detailed description, supports fuzzy matching'),
      os: z.string().optional().describe('Operating system'),
      platform: z.string().optional().describe('Software platform'),
      testmode: z.string().optional().describe('Test mode'),
      testphase: z.string().optional().describe('Test phase'),
      testtype: z.string().optional().describe('Test type'),
      size: z.string().optional().describe('Size'),
      estimate: z.number().optional().describe('Estimated resolve time'),
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
      return client.get('/bugs', convertedParams);
    },
  },
  {
    name: 'tapd_create_bug',
    description: 'Create a new bug in TAPD',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      title: z.string().describe('Bug title (required)'),
      priority: z.string().optional().describe('Priority'),
      priority_label: z.string().optional().describe('Priority label (recommended)'),
      severity: z.string().optional().describe('Severity'),
      current_owner: z.string().optional().describe('Current owner (defaults to TAPD_NICK_NAME env)'),
      description: z.string().optional().describe('Detailed description'),
      module: z.string().optional().describe('Module'),
      iteration_id: z.string().optional().describe('Iteration ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      label: z.string().optional().describe('Label, multiple values separated by |'),
      effort: z.number().optional().describe('Estimated effort'),
      template_id: z.string().optional().describe('Template ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      cc: z.string().optional().describe('CC person'),
      te: z.string().optional().describe('Tester'),
      de: z.string().optional().describe('Developer'),
      reporter: z.string().optional().describe('Reporter'),
      participator: z.string().optional().describe('Participant'),
      auditer: z.string().optional().describe('Auditor'),
      confirmer: z.string().optional().describe('Confirmer'),
      fixer: z.string().optional().describe('Fixer'),
      closer: z.string().optional().describe('Closer'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      deadline: z.string().optional().describe('Resolve deadline, Format: YYYY-MM-DD'),
      release_id: z.string().optional().describe('Release plan；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      version_report: z.string().optional().describe('Found version'),
      version_test: z.string().optional().describe('Verify version'),
      version_fix: z.string().optional().describe('Fix version'),
      version_close: z.string().optional().describe('Close version'),
      baseline_find: z.string().optional().describe('Found baseline'),
      baseline_join: z.string().optional().describe('Join baseline'),
      baseline_test: z.string().optional().describe('Test baseline'),
      baseline_close: z.string().optional().describe('Close baseline'),
      feature: z.string().optional().describe('Feature'),
      source: z.string().optional().describe('Bug root cause'),
      bugtype: z.string().optional().describe('Bug type'),
      frequency: z.string().optional().describe('Reproduction frequency'),
      originphase: z.string().optional().describe('Found phase'),
      sourcephase: z.string().optional().describe('Introduction phase'),
      resolution: z.string().optional().describe('Resolution method'),
      os: z.string().optional().describe('Operating system'),
      platform: z.string().optional().describe('Software platform'),
      testmode: z.string().optional().describe('Test mode'),
      testphase: z.string().optional().describe('Test phase'),
      testtype: z.string().optional().describe('Test type'),
      size: z.string().optional().describe('Size'),
      estimate: z.number().optional().describe('Estimated resolve time'),
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
        workspace_id: workspaceId,
        current_owner: params.current_owner ?? nickName,
        reporter: params.reporter ?? nickName,
      };
      return client.post('/bugs', finalParams);
    },
  },
  {
    name: 'tapd_update_bug',
    description: 'Update an existing bug in TAPD',
    inputSchema: z.object({
      id: z.string().describe('Bug ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      title: z.string().optional().describe('Bug title'),
      priority: z.string().optional().describe('Priority'),
      priority_label: z.string().optional().describe('Priority label (recommended)'),
      severity: z.string().optional().describe('Severity'),
      status: z.string().optional().describe('Status'),
      current_owner: z.string().optional().describe('Current owner'),
      description: z.string().optional().describe('Detailed description'),
      module: z.string().optional().describe('Module'),
      iteration_id: z.string().optional().describe('Iteration ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      label: z.string().optional().describe('Label, multiple values separated by |'),
      effort: z.number().optional().describe('Estimated effort'),
      cc: z.string().optional().describe('CC person'),
      te: z.string().optional().describe('Tester'),
      de: z.string().optional().describe('Developer'),
      reporter: z.string().optional().describe('Reporter'),
      participator: z.string().optional().describe('Participant'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      deadline: z.string().optional().describe('Resolve deadline, Format: YYYY-MM-DD'),
      release_id: z.string().optional().describe('Release plan；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      version_report: z.string().optional().describe('Found version'),
      version_test: z.string().optional().describe('Verify version'),
      version_fix: z.string().optional().describe('Fix version'),
      version_close: z.string().optional().describe('Close version'),
      baseline_find: z.string().optional().describe('Found baseline'),
      baseline_join: z.string().optional().describe('Join baseline'),
      baseline_test: z.string().optional().describe('Test baseline'),
      baseline_close: z.string().optional().describe('Close baseline'),
      feature: z.string().optional().describe('Feature'),
      source: z.string().optional().describe('Bug root cause'),
      bugtype: z.string().optional().describe('Bug type'),
      frequency: z.string().optional().describe('Reproduction frequency'),
      originphase: z.string().optional().describe('Found phase'),
      sourcephase: z.string().optional().describe('Introduction phase'),
      resolution: z.string().optional().describe('Resolution method'),
      os: z.string().optional().describe('Operating system'),
      platform: z.string().optional().describe('Software platform'),
      testmode: z.string().optional().describe('Test mode'),
      testphase: z.string().optional().describe('Test phase'),
      testtype: z.string().optional().describe('Test type'),
      size: z.string().optional().describe('Size'),
      estimate: z.number().optional().describe('Estimated resolve time'),
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
        workspace_id: workspaceId,
      };
      return client.post('/bugs', convertedParams);
    },
  },
  {
    name: 'tapd_get_bug_count',
    description: 'Get the count of bugs matching filters',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      title: z.string().optional().describe('Bug title, supports fuzzy matching'),
      priority: z.string().optional().describe('Priority, recommend using priority_label'),
      priority_label: z.string().optional().describe('Priority (recommended)'),
      severity: z.string().optional().describe('Severity, supports enum query'),
      status: z.string().optional().describe('Status, supports enum query'),
      v_status: z.string().optional().describe('Status (Chinese)'),
      label: z.string().optional().describe('Label, supports enum query'),
      iteration_id: z.string().optional().describe('Iteration ID, supports enum query；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      module: z.string().optional().describe('Module, supports enum query'),
      current_owner: z.string().optional().describe('Current owner, supports fuzzy matching'),
      reporter: z.string().optional().describe('Reporter, supports multiple users query'),
      participator: z.string().optional().describe('Participant, supports multiple users query'),
      te: z.string().optional().describe('Tester, supports fuzzy matching'),
      de: z.string().optional().describe('Developer, supports fuzzy matching'),
      cc: z.string().optional().describe('CC person'),
      created: z.string().optional().describe('Creation time, Format: YYYY-MM-DD HH:mm'),
      in_progress_time: z.string().optional().describe('Accept time, Format: YYYY-MM-DD HH:mm'),
      resolved: z.string().optional().describe('Resolve time, Format: YYYY-MM-DD HH:mm'),
      verify_time: z.string().optional().describe('Verify time, Format: YYYY-MM-DD HH:mm'),
      closed: z.string().optional().describe('Close time, Format: YYYY-MM-DD HH:mm'),
      reject_time: z.string().optional().describe('Reject time, Format: YYYY-MM-DD HH:mm'),
      modified: z.string().optional().describe('Last modification time, Format: YYYY-MM-DD HH:mm'),
      begin: z.string().optional().describe('Estimated start date, Format: YYYY-MM-DD'),
      due: z.string().optional().describe('Estimated end date, Format: YYYY-MM-DD'),
      deadline: z.string().optional().describe('Resolve deadline, Format: YYYY-MM-DD'),
      release_id: z.string().optional().describe('Release plan；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      version_report: z.string().optional().describe('Found version, enum query'),
      version_test: z.string().optional().describe('Verify version'),
      version_fix: z.string().optional().describe('Fix version'),
      version_close: z.string().optional().describe('Close version'),
      baseline_find: z.string().optional().describe('Found baseline'),
      baseline_join: z.string().optional().describe('Join baseline'),
      baseline_test: z.string().optional().describe('Test baseline'),
      baseline_close: z.string().optional().describe('Close baseline'),
      feature: z.string().optional().describe('Feature'),
      source: z.string().optional().describe('Bug root cause, supports enum query'),
      bugtype: z.string().optional().describe('Bug type'),
      frequency: z.string().optional().describe('Reproduction frequency, supports enum query'),
      originphase: z.string().optional().describe('Found phase'),
      sourcephase: z.string().optional().describe('Introduction phase'),
      resolution: z.string().optional().describe('Resolution method, supports enum query'),
      description: z.string().optional().describe('Detailed description, supports fuzzy matching'),
      os: z.string().optional().describe('Operating system'),
      platform: z.string().optional().describe('Software platform'),
      testmode: z.string().optional().describe('Test mode'),
      testphase: z.string().optional().describe('Test phase'),
      testtype: z.string().optional().describe('Test type'),
      size: z.string().optional().describe('Size'),
      estimate: z.number().optional().describe('Estimated resolve time'),
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
      return client.get('/bugs/count', convertedParams);
    },
  },
  // 缺陷变更历史
  {
    name: 'tapd_get_bug_changes',
    description: '获取缺陷变更历史',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('变更记录ID，支持多ID查询；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      bug_id: z.string().optional().describe('缺陷ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      field: z.string().optional().describe('变更字段'),
      value_before: z.string().optional().describe('变更前值'),
      value_after: z.string().optional().describe('变更后值'),
      user: z.string().optional().describe('变更人'),
      created: z.string().optional().describe('创建时间，支持时间查询'),
      limit: z.number().optional().describe('返回数量，默认30，最大200'),
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
        bug_id: params.bug_id ? TapdClient.toLongId(params.bug_id, workspaceId) : undefined,
        workspace_id: workspaceId,
      };
      return client.get('/bug_changes', convertedParams);
    },
  },
  {
    name: 'tapd_get_bug_changes_count',
    description: '获取缺陷变更次数',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      bug_id: z.string().optional().describe('缺陷ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      field: z.string().optional().describe('变更字段'),
      user: z.string().optional().describe('变更人'),
      created: z.string().optional().describe('创建时间'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        bug_id: params.bug_id ? TapdClient.toLongId(params.bug_id, workspaceId) : undefined,
        workspace_id: workspaceId,
      };
      return client.get('/bug_changes/count', convertedParams);
    },
  },
  // 缺陷字段配置
  {
    name: 'tapd_get_bug_custom_fields_settings',
    description: '获取缺陷自定义字段配置',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/bugs/custom_fields_settings', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_bug_fields_info',
    description: '获取缺陷字段信息',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/bugs/get_fields_info', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_bug_fields_lable',
    description: '获取缺陷字段中英文对照',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/bugs/fields_lable', { ...params, workspace_id: workspaceId });
    },
  },
  // 缺陷模板
  {
    name: 'tapd_get_bug_template_list',
    description: '获取缺陷模板列表',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      limit: z.number().optional().describe('返回数量'),
      page: z.number().optional().describe('页码'),
      fields: z.string().optional().describe('返回字段'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/bugs/templates', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_default_bug_template',
    description: '获取缺陷默认模板',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/bugs/default_template', { ...params, workspace_id: workspaceId });
    },
  },
  // 批量操作
  {
    name: 'tapd_batch_update_bugs',
    description: '批量更新缺陷',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      bugs: z.string().describe('缺陷更新数组JSON，最多50条 (必填)'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      // TAPD API expects bugs as a JSON string
      // Parse and convert bug IDs
      const bugsJson = params.bugs;
      const bugs = JSON.parse(bugsJson) as ({ id: string } & Record<string, string | number | undefined>)[];
      const convertedBugs = bugs.map((bug) => {
        const { id, ...rest } = bug;
        return {
          id: TapdClient.toLongId(id, workspaceId),
          ...rest,
        };
      });
      const convertedBugsJson = JSON.stringify(convertedBugs);
      return client.post('/bugs/batch_update', {
        workspace_id: workspaceId,
        bugs: convertedBugsJson,
      });
    },
  },
  {
    name: 'tapd_copy_bug',
    description: '复制缺陷',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('要复制的缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      title: z.string().optional().describe('新缺陷标题（默认为原标题）'),
      current_owner: z.string().optional().describe('处理人'),
      iteration_id: z.string().optional().describe('迭代ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      copy_attachments: z.number().optional().describe('是否复制附件，值=1复制'),
      copy_comments: z.number().optional().describe('是否复制评论，值=1复制'),
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
      return client.post('/bugs/copy', convertedParams);
    },
  },
  // 缺陷关联
  {
    name: 'tapd_get_link_bugs',
    description: '获取缺陷关联关系',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      bug_id: z.string().describe('缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        bug_id: TapdClient.toLongId(params.bug_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.get('/bugs/get_link_bugs', convertedParams);
    },
  },
  {
    name: 'tapd_link_bugs',
    description: '关联缺陷',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      bug_id: z.string().describe('主缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      link_bug_id: z.string().describe('关联缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      link_type: z.string().optional().describe('关联类型（前置/后置等）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        bug_id: TapdClient.toLongId(params.bug_id, workspaceId),
        link_bug_id: TapdClient.toLongId(params.link_bug_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/bugs/link_bugs', convertedParams);
    },
  },
  {
    name: 'tapd_delete_link_bugs',
    description: '取消关联缺陷',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      bug_id: z.string().describe('主缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      link_bug_id: z.string().describe('要取消关联的缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        bug_id: TapdClient.toLongId(params.bug_id, workspaceId),
        link_bug_id: TapdClient.toLongId(params.link_bug_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.post('/bugs/delete_link_bugs', convertedParams);
    },
  },
  {
    name: 'tapd_get_related_stories',
    description: '获取缺陷关联需求',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      bug_id: z.string().describe('缺陷ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const convertedParams = {
        ...params,
        bug_id: TapdClient.toLongId(params.bug_id, workspaceId),
        workspace_id: workspaceId,
      };
      return client.get('/bugs/get_related_stories', convertedParams);
    },
  },
  // 其他
  {
    name: 'tapd_get_bugs_by_view_conf_id',
    description: '获取视图缺陷列表',
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
      return client.get('/bugs/by_view_conf_id', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_removed_bugs',
    description: '获取回收站缺陷',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('缺陷ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      title: z.string().optional().describe('标题'),
      current_owner: z.string().optional().describe('处理人'),
      reporter: z.string().optional().describe('创建人'),
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
      return client.get('/bugs/removed', convertedParams);
    },
  },
  {
    name: 'tapd_bug_ids_to_query_token',
    description: '转换缺陷ID为queryToken',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      ids: z.string().describe('缺陷ID列表，逗号分隔 (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client: TapdClient, params: { workspace_id?: number; ids: string }) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      // Convert comma-separated IDs: split → convert each → join
      const convertedIds = params.ids.split(',').map((id: string) => TapdClient.toLongId(id.trim(), workspaceId)).join(',');
      return client.get('/bugs/ids_to_query_token', {
        workspace_id: workspaceId,
        ids: convertedIds,
      });
    },
  },
];
