import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const customFieldTools: ToolDef[] = [
  {
    name: "tapd_get_story_custom_fields",
    description: "Get story custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      workitem_type_id: z.string().optional().describe("Work item type ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/stories/custom_fields_settings", params);
    },
  },
  {
    name: "tapd_get_bug_custom_fields",
    description: "Get bug custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      workitem_type_id: z.string().optional().describe("Work item type ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/bugs/custom_fields_settings", params);
    },
  },
  {
    name: "tapd_get_task_custom_fields",
    description: "Get task custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/tasks/custom_fields_settings", params);
    },
  },
  {
    name: "tapd_get_test_case_custom_fields",
    description: "Get test case custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/tcases/custom_fields_settings", params);
    },
  },
  {
    name: "tapd_get_iteration_custom_fields",
    description: "Get iteration custom fields settings",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/iterations/custom_fields_settings", params);
    },
  },
  {
    name: "tapd_get_story_fields_info",
    description: "Get story fields information",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      workitem_type_id: z.string().optional().describe("Work item type ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/stories/get_fields_info", params);
    },
  },
  {
    name: "tapd_get_bug_fields_info",
    description: "Get bug fields information",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      workitem_type_id: z.string().optional().describe("Work item type ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/bugs/get_fields_info", params);
    },
  },
  {
    name: "tapd_get_task_fields_info",
    description: "Get task fields information",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/tasks/get_fields_info", params);
    },
  },
  {
    name: "tapd_get_test_case_fields_info",
    description: "Get test case fields information",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/tcases/get_fields_info", params);
    },
  },
];