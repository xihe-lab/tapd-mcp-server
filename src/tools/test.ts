import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const testTools: ToolDef[] = [
  {
    name: "tapd_create_test_case",
    description: "Create a new test case in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      name: z.string().describe("Test case name (required)"),
      category_id: z.string().optional().describe("Category ID"),
      priority: z.string().optional().describe("Priority level"),
      creator: z.string().optional().describe("Creator (defaults to TAPD_NICK_NAME env)"),
      owner: z.string().optional().describe("Owner"),
      description: z.string().optional().describe("Test case description"),
      teststeps: z.string().optional().describe("Test steps"),
      expectresult: z.string().optional().describe("Expected result"),
      status: z.string().optional().describe("Status"),
      iteration_id: z.string().optional().describe("Iteration ID"),
      custom_field_one: z.string().optional().describe("Custom field 1 (supports 1-200)"),
    }),
    handler: async (client, params) => {
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        creator: params.creator ?? nickName,
      };
      return client.post("/tcases", finalParams);
    },
  },
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
      owner: z.string().optional().describe("Owner"),
      priority: z.string().optional().describe("Priority level"),
      iteration_id: z.string().optional().describe("Iteration ID"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Modification time, supports time query"),
      custom_field_one: z.string().optional().describe("Custom field 1 (supports 1-200)"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/tcases", params);
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
  {
    name: "tapd_create_test_plan",
    description: "Create a new test plan in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      name: z.string().describe("Test plan name (required)"),
      description: z.string().optional().describe("Test plan description"),
      owner: z.string().optional().describe("Owner (defaults to TAPD_NICK_NAME env)"),
      creator: z.string().optional().describe("Creator (defaults to TAPD_NICK_NAME env)"),
      begin: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      status: z.string().optional().describe("Status"),
      category_id: z.string().optional().describe("Category ID"),
      iteration_id: z.string().optional().describe("Iteration ID"),
    }),
    handler: async (client, params) => {
      const nickName = TapdClient.getNickName();
      const finalParams = {
        ...params,
        owner: params.owner ?? nickName,
        creator: params.creator ?? nickName,
      };
      return client.post("/test_plans", finalParams);
    },
  },
  {
    name: "tapd_update_test_plan",
    description: "Update an existing test plan in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      id: z.string().describe("Test plan ID (required)"),
      name: z.string().optional().describe("Test plan name"),
      description: z.string().optional().describe("Test plan description"),
      owner: z.string().optional().describe("Owner"),
      begin: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      status: z.string().optional().describe("Status"),
      category_id: z.string().optional().describe("Category ID"),
      iteration_id: z.string().optional().describe("Iteration ID"),
    }),
    handler: async (client, params) => {
      return client.post("/test_plans", params);
    },
  },
  {
    name: "tapd_get_test_plan_count",
    description: "Get the count of test plans",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      id: z.string().optional().describe("Test plan ID"),
      name: z.string().optional().describe("Test plan name"),
      status: z.string().optional().describe("Status"),
      creator: z.string().optional().describe("Creator"),
      owner: z.string().optional().describe("Owner"),
    }),
    handler: async (client, params) => {
      return client.get("/test_plans/count", params);
    },
  },
];
