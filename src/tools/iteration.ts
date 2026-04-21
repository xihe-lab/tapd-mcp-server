import { z } from 'zod';
import type { ToolDef } from '../types.js';
import type { TapdClient } from '../tapd-client.js';

export const iterationTools: ToolDef[] = [
  {
    name: "tapd_get_iterations",
    description: "Get iterations with optional filters",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      id: z.number().optional().describe("Iteration ID, supports multi-ID query"),
      name: z.string().optional().describe("Iteration title, supports fuzzy matching"),
      status: z.string().optional().describe("Status: open/done or custom Chinese status"),
      startdate: z.string().optional().describe("Start date, supports time query"),
      enddate: z.string().optional().describe("End date, supports time query"),
      creator: z.string().optional().describe("Creator"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Modification time, supports time query"),
      completed: z.string().optional().describe("Completion time"),
      workitem_type_id: z.number().optional().describe("Iteration category"),
      plan_app_id: z.number().optional().describe("Plan application ID"),
      locker: z.string().optional().describe("Locked by user"),
      limit: z.number().optional().describe("Return count limit, default 30, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order"),
      fields: z.string().optional().describe("Specify return fields"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/iterations", params);
    },
  },
  {
    name: "tapd_create_iteration",
    description: "Create a new iteration",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      name: z.string().describe("Iteration name"),
      startdate: z.string().optional().describe("Start date"),
      enddate: z.string().optional().describe("End date"),
      description: z.string().optional().describe("Iteration description"),
      status: z.string().optional().describe("Status: open/done"),
      workitem_type_id: z.number().optional().describe("Iteration category"),
      plan_app_id: z.number().optional().describe("Plan application ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.post("/iterations", params);
    },
  },
  {
    name: "tapd_update_iteration",
    description: "Update an existing iteration",
    inputSchema: z.object({
      id: z.number().describe("Iteration ID"),
      workspace_id: z.number().describe("Project ID"),
      name: z.string().optional().describe("Iteration name"),
      startdate: z.string().optional().describe("Start date"),
      enddate: z.string().optional().describe("End date"),
      description: z.string().optional().describe("Iteration description"),
      status: z.string().optional().describe("Status: open/done"),
      workitem_type_id: z.number().optional().describe("Iteration category"),
      plan_app_id: z.number().optional().describe("Plan application ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.post("/iterations", params);
    },
  },
  {
    name: "tapd_get_iteration_count",
    description: "Get count of iterations matching filters",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      name: z.string().optional().describe("Iteration title, supports fuzzy matching"),
      status: z.string().optional().describe("Status: open/done or custom Chinese status"),
      startdate: z.string().optional().describe("Start date, supports time query"),
      enddate: z.string().optional().describe("End date, supports time query"),
      creator: z.string().optional().describe("Creator"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Modification time, supports time query"),
      completed: z.string().optional().describe("Completion time"),
      workitem_type_id: z.number().optional().describe("Iteration category"),
      plan_app_id: z.number().optional().describe("Plan application ID"),
      locker: z.string().optional().describe("Locked by user"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/iterations/count", params);
    },
  },
];
