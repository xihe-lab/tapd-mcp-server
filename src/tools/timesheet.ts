import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const timesheetTools: ToolDef[] = [
  {
    name: "tapd_get_timesheets",
    description: "Get timesheet records from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe("项目ID（可省略，使用默认配置）"),
      id: z.string().optional().describe("Timesheet ID, supports multiple IDs"),
      entity_type: z.string().optional().describe("Entity type: story, task, or bug"),
      entity_id: z.string().optional().describe("Entity ID"),
      timespent: z.string().optional().describe("Hours spent"),
      spentdate: z.string().optional().describe("Spent date, supports time query"),
      modified: z.string().optional().describe("Last modified time, supports time query"),
      owner: z.string().optional().describe("Timesheet owner"),
      created: z.string().optional().describe("Creation time, supports time query"),
      memo: z.string().optional().describe("Work description"),
      is_delete: z.number().optional().describe("Is deleted: 0-active (default), 1-deleted"),
      workflow_step: z.string().optional().describe("Workflow step name"),
      relation_type: z.string().optional().describe("Relation type: entity or workflow"),
      include_parent_story_timesheet: z.number().optional().describe("Include parent story timesheet: 0-no, 1-yes"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
      order: z.string().optional().describe("Sort order, e.g., 'created desc'"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/timesheets", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_timesheet",
    description: "Create a new timesheet entry",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe("项目ID（可省略，使用默认配置）"),
      owner: z.string().optional().describe("Owner (defaults to TAPD_NICK_NAME env)"),
      entity_type: z.string().describe("Type: story, task, or bug"),
      entity_id: z.string().describe("ID of the story, bug, or task"),
      spentdate: z.string().describe("Date of work (YYYY-MM-DD)"),
      timespent: z.number().describe("Hours spent"),
      memo: z.string().optional().describe("Work description"),
      timeremain: z.string().optional().describe("Remaining hours"),
      cc: z.string().optional().describe("Copy to users, separated by |"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const finalParams = {
        ...params,
        workspace_id: workspaceId,
        owner: params.owner ?? TapdClient.getNickName(),
      };
      return client.post("/timesheets", finalParams);
    },
  },
  {
    name: "tapd_get_timesheet_count",
    description: "Get the count of timesheet records matching criteria",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe("项目ID（可省略，使用默认配置）"),
      entity_type: z.string().optional().describe("Entity type: story, task, or bug"),
      entity_id: z.string().optional().describe("Entity ID"),
      owner: z.string().optional().describe("Timesheet owner"),
      spentdate: z.string().optional().describe("Spent date, supports time query"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Last modified time, supports time query"),
      is_delete: z.number().optional().describe("Is deleted"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/timesheets/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_update_timesheet",
    description: "更新工时记录",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe("项目ID（可省略，使用默认配置）"),
      id: z.string().describe("工时记录ID (必填)"),
      timespent: z.number().optional().describe("工时"),
      memo: z.string().optional().describe("工作描述"),
      spentdate: z.string().optional().describe("工作日期 YYYY-MM-DD"),
      timeremain: z.string().optional().describe("剩余工时"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/timesheets", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_delete_timesheets",
    description: "删除工时记录",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe("项目ID（可省略，使用默认配置）"),
      id: z.string().describe("工时记录ID (必填)"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.post("/timesheets/delete", { ...params, workspace_id: workspaceId });
    },
  },
];
