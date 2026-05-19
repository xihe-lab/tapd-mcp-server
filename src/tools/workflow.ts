import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const workflowTools: ToolDef[] = [
  {
    name: "tapd_get_workflows",
    description: "Get workflow definitions for a project",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      system: z.string().optional().describe("Workflow system: story, bug, task, or testcase"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_workflow_status_map",
    description: "Get workflow status mappings for a project (获取工作流状态中英文名对应关系)",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      system: z.string().describe("系统名，取 'bug' 或 'story' (必填)"),
      workitem_type_id: z.number().optional().describe("需求类别ID，获取需求状态时必传"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows/status_map", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_workflow_step_map",
    description: "Get workflow step/node information for a specific work item type (故事类别工作流节点)",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      system: z.string().describe("系统名，当前仅支持 'story' (必填)"),
      workitem_type_id: z.number().describe("需求类别ID (必填)"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows/step_map", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_workflow_all_transitions",
    description: "获取工作流所有转换",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      system: z.string().describe("系统名: story, bug, task (必填)"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows/all_transitions", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_workflow_last_steps",
    description: "获取工作流最后步骤",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      system: z.string().describe("系统名: story, bug, task (必填)"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows/last_steps", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_workflow_all_last_steps",
    description: "获取工作流所有最后步骤",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows/all_last_steps", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_workflow_first_step",
    description: "获取工作流第一步",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      system: z.string().describe("系统名: story, bug, task (必填)"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/workflows/first_step", { ...params, workspace_id: workspaceId });
    },
  },
];
