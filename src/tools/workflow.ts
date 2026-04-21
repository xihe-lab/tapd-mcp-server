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
    description: "Get workflow status mappings for a project",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      system: z.string().optional().describe("Workflow system: story, bug, task, or testcase"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/workflows/status_map", params);
    },
  },
];
