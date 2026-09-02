import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const programTools: ToolDef[] = [
  {
    name: "tapd_program_relate_workspace",
    description: "项目集关联项目",
    inputSchema: z.object({
      program_id: z.number().describe("项目集ID (必填)"),
      workspace_ids: z.string().describe("项目ID列表，多个以逗号分隔 (必填)"),
    }),
    handler: async (client, params) => {
      return client.post("/program_workspaces/add", params);
    },
  },
  {
    name: "tapd_program_bind_entities",
    description: "项目集绑定实体",
    inputSchema: z.object({
      program_id: z.number().describe("项目集ID (必填)"),
      entity_type: z.string().describe("实体类型: story/bug/task (必填)"),
      entity_ids: z.string().describe("实体ID列表，多个以逗号分隔 (必填)"),
    }),
    handler: async (client, params) => {
      return client.post("/program_entities/bind", params);
    },
  },
];