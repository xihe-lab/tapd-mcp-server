import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const workflowTools: ToolDef[] = [
  {
    name: "tapd_get_workflows",
    description: "Get workflow definitions for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      system: z.string().optional().describe("Workflow system: story, bug, task, or testcase"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/workflows", params);
    },
  },
  {
    name: "tapd_get_workflow_status_map",
    description: "Get workflow status mappings for a project (获取工作流状态中英文名对应关系)",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (必填)"),
      system: z.string().describe("系统名，取 'bug' 或 'story' (必填)"),
      workitem_type_id: z.number().optional().describe("需求类别ID，获取需求状态时必传"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/workflows/status_map", params);
    },
  },
  {
    name: "tapd_get_workflow_step_map",
    description: "Get workflow step/node information for a specific work item type (故事类别工作流节点)",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (必填)"),
      system: z.string().describe("系统名，当前仅支持 'story' (必填)"),
      workitem_type_id: z.number().describe("需求类别ID (必填)"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/workflows/step_map", params);
    },
  },
];
