import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const timesheetTools: ToolDef[] = [
  {
    name: "tapd_get_timesheets",
    description: "Get timesheet records from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      user: z.string().optional().describe("User name filter"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      return client.get("/timesheets", params);
    },
  },
  {
    name: "tapd_create_timesheet",
    description: "Create a new timesheet entry",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      user: z.string().optional().describe("User name (defaults to TAPD_NICK_NAME env)"),
      item_type: z.string().describe("Type: story, bug, or task"),
      item_id: z.string().describe("ID of the story, bug, or task"),
      timesheet_date: z.string().describe("Date of work (YYYY-MM-DD)"),
      spent_time: z.number().describe("Hours spent"),
      content: z.string().describe("Work description"),
      cc: z.string().optional().describe("Copy to users, separated by |"),
    }),
    handler: async (client, params) => {
      const finalParams = {
        ...params,
        user: params.user || TapdClient.getNickName(),
      };
      return client.post("/timesheets", finalParams);
    },
  },
  {
    name: "tapd_get_timesheet_count",
    description: "Get the count of timesheet records matching criteria",
    inputSchema: z.object({
      workspace_id: z.number().describe("Project ID"),
      user: z.string().optional().describe("User name filter"),
      start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
    }),
    handler: async (client, params) => {
      return client.get("/timesheets/count", params);
    },
  },
];
