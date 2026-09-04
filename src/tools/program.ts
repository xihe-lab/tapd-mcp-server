import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const programTools: ToolDef[] = [
  {
    name: "tapd_program_relate_workspace",
    description: "项目集关联项目",
    inputSchema: z.object({
      program_id: z.string().describe("项目集ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      workspace_ids: z.string().describe('项目ID列表，多个以逗号分隔 (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      return client.post("/program_workspaces/add", params);
    },
  },
  {
    name: "tapd_program_bind_entities",
    description: "项目集绑定实体",
    inputSchema: z.object({
      program_id: z.string().describe("项目集ID (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度"),
      entity_type: z.string().describe("实体类型: story/bug/task (必填)"),
      entity_ids: z.string().describe('实体ID列表，多个以逗号分隔 (必填)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      return client.post("/program_entities/bind", params);
    },
  },
];