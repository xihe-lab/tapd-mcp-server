import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const changeTools: ToolDef[] = [
  {
    name: "tapd_get_story_changes",
    description: "Get story change history",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      story_id: z.string().optional().describe("Story ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/story_changes", params);
    },
  },
  {
    name: "tapd_get_story_changes_count",
    description: "Get the count of story changes",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      story_id: z.string().optional().describe("Story ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/story_changes/count", params);
    },
  },
  {
    name: "tapd_get_bug_changes",
    description: "Get bug change history",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      bug_id: z.string().optional().describe("Bug ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/bug_changes", params);
    },
  },
  {
    name: "tapd_get_bug_changes_count",
    description: "Get the count of bug changes",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      bug_id: z.string().optional().describe("Bug ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/bug_changes/count", params);
    },
  },
  {
    name: "tapd_get_task_changes",
    description: "Get task change history",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      task_id: z.string().optional().describe("Task ID"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/task_changes", params);
    },
  },
  {
    name: "tapd_get_task_changes_count",
    description: "Get the count of task changes",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID (required)"),
      task_id: z.string().optional().describe("Task ID"),
    }),
    handler: async (client: TapdClient, params) => {
      return client.get("/task_changes/count", params);
    },
  },
];