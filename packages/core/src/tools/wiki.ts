import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

export const wikiTools: ToolDef[] = [
  {
    name: "tapd_get_wikis",
    description: "Get wiki pages from TAPD",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Wiki ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Wiki page name, supports fuzzy matching"),
      creator: z.string().optional().describe("Creator name"),
      modifier: z.string().optional().describe("Last modifier name"),
      note: z.string().optional().describe("Note/remark"),
      view_count: z.string().optional().describe("View count"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Last modified time, supports time query"),
      status: z.string().optional().describe("Status of the wiki page"),
      category_id: z.string().optional().describe('Category ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
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
      return client.get("/tapd_wikis", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_create_wiki",
    description: "Create a new wiki page in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      name: z.string().describe("Wiki page title"),
      creator: z.string().optional().describe("Creator name (defaults to TAPD_NICK_NAME env)"),
      description: z.string().optional().describe("Rich text content"),
      markdown_description: z.string().optional().describe("Markdown content"),
      note: z.string().optional().describe("Note/remark"),
      parent_wiki_id: z.string().optional().describe('Parent wiki ID for nested pages；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const creator = params.creator ?? process.env.TAPD_NICK_NAME;
      if (!creator) {
        throw new Error("creator is required. Set TAPD_NICK_NAME environment variable or provide creator parameter.");
      }
      const body = { ...params, workspace_id: workspaceId, creator };
      // TAPD create 同传 description + markdown_description 时丢弃 description（D8 实证），
      // 拆两段：先建 HTML 正文，再 update 双字段回填（update 双传两字段均持久化）
      if (body.description && body.markdown_description) {
        const { markdown_description, ...createBody } = body;
        const created = await client.post('/tapd_wikis', createBody);
        const wikiId = (created as { Wiki?: { id?: string } })?.Wiki?.id;
        if (!wikiId) return created;
        return client.post('/tapd_wikis', {
          id: wikiId,
          workspace_id: workspaceId,
          description: body.description,
          markdown_description,
        });
      }
      return client.post("/tapd_wikis", body);
    },
  },
  {
    name: "tapd_update_wiki",
    description: "Update an existing wiki page in TAPD",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Wiki ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Wiki page title"),
      modifier: z.string().optional().describe("Modifier name (defaults to TAPD_NICK_NAME env)"),
      description: z.string().optional().describe("Rich text content"),
      markdown_description: z.string().optional().describe("Markdown content"),
      note: z.string().optional().describe("Note/remark"),
      parent_wiki_id: z.string().optional().describe('Parent wiki ID for nested pages；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      const modifier = params.modifier ?? process.env.TAPD_NICK_NAME;
      if (!modifier) {
        throw new Error("modifier is required. Set TAPD_NICK_NAME environment variable or provide modifier parameter.");
      }
      return client.post("/tapd_wikis", {
        ...params,
        workspace_id: workspaceId,
        modifier,
      });
    },
  },
  {
    name: "tapd_get_wiki_count",
    description: "Get the count of wiki pages matching filters",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Wiki ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Wiki page name, supports fuzzy matching"),
      creator: z.string().optional().describe("Creator name"),
      modifier: z.string().optional().describe("Last modifier name"),
      note: z.string().optional().describe("Note/remark"),
      view_count: z.string().optional().describe("View count"),
      created: z.string().optional().describe("Creation time, supports time query"),
      modified: z.string().optional().describe("Last modified time, supports time query"),
      status: z.string().optional().describe("Status of the wiki page"),
      category_id: z.string().optional().describe('Category ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_attachments_count",
    description: "Get the count of wiki attachments",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      wiki_id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_attachments/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_drawios",
    description: "Get DrawIO data from wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_drawios", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_entity_permissions",
    description: "Get entity permissions of wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_entity_permissions", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_followers",
    description: "Get followers of wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      wiki_id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      user: z.string().optional().describe("User name"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_followers", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_followers_count",
    description: "Get the count of wiki followers",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      wiki_id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      user: z.string().optional().describe("User name"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_followers/count", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_tags",
    description: "Get tags of wiki pages",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      wiki_id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Tag name"),
      limit: z.number().optional().describe("Number of results to return, max 200"),
      page: z.number().optional().describe("Page number, default 1"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_tags", { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: "tapd_get_wiki_tags_count",
    description: "Get the count of wiki tags",
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      wiki_id: z.string().optional().describe('Wiki ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      name: z.string().optional().describe("Tag name"),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get("/tapd_wikis_tags/count", { ...params, workspace_id: workspaceId });
    },
  },
];
