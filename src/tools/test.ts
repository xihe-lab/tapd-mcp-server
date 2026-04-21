import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const testTools: ToolDef[] = [
  {
    name: "tapd_get_test_cases",
    description: "Get test cases from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      id: z.string().optional().describe("Test case ID, supports multiple IDs"),
      name: z.string().optional().describe("Test case name, supports fuzzy matching"),
      status: z.string().optional().describe("Status of the test case"),
      category_id: z.string().optional().describe("Category ID"),
      creator: z.string().optional().describe("Creator name"),
      priority: z.string().optional().describe("Priority level"),
      iteration_id: z.string().optional().describe("Iteration ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/test_cases", params);
    },
  },
  {
    name: "tapd_get_test_plans",
    description: "Get test plans from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      id: z.string().optional().describe("Test plan ID, supports multiple IDs"),
      name: z.string().optional().describe("Test plan name, supports fuzzy matching"),
      status: z.string().optional().describe("Status of the test plan"),
      creator: z.string().optional().describe("Creator name"),
      owner: z.string().optional().describe("Owner name"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/test_plans", params);
    },
  },
];
