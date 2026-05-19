# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

TAPD MCP Server — an MCP (Model Context Protocol) server that exposes TAPD (Tencent Agile Product Development) APIs as tools for AI assistants like Claude, Cursor, and VS Code.

- **Package**: `@xihe-lab/tapd-mcp-server`
- **Runtime**: Node.js >= 18, ESM (`"type": "module"`)
- **Transport**: stdio

## Common Commands

```bash
npm install
npm run build       # TypeScript compile (tsc)
npm run dev         # Run with tsx in dev mode
npm run type-check  # Type check without emitting
npm run lint        # ESLint
```

## Architecture

```
src/
  index.ts          # Entry point, starts stdio transport
  server.ts         # MCP server init + tool registration
  tapd-client.ts    # HTTP client (TapdClient), dual auth support
  types.ts          # ToolDef interface and shared types
  utils.ts          # Utility helpers
  tools/
    index.ts        # Aggregates all tool modules into allTools[]
    *.ts            # Individual tool modules (25 modules)
```

### Adding a New Tool

1. Create `src/tools/<module>.ts` exporting a `ToolDef[]` array
2. Import and spread it in `src/tools/index.ts`

Tool definition pattern:

```typescript
import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const myTools: ToolDef[] = [
  {
    name: 'tapd_my_tool',
    description: 'Tool description',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID(可省略,使用默认配置)'),
      // ... params
    }),
    handler: async (client, params) => {
      return client.get('/some_endpoint', params);
    },
  },
];
```

### ToolDef Interface

```typescript
interface ToolDef {
  name: string;               // e.g. tapd_get_stories
  description: string;        // Natural language description for LLM
  inputSchema: z.ZodTypeAny;  // Zod schema for input validation
  handler: (client: TapdClient, params: any) => Promise<unknown>;
}
```

### TapdClient

Dual authentication via `TapdClient`:

- `TapdClient.fromAccessToken(token)` — Bearer Token (recommended)
- `TapdClient.fromBasicAuth(user, password)` — Basic Auth

Static helpers for defaults from env vars:

- `TapdClient.getDefaultWorkspaceId()` — `TAPD_DEFAULT_WORKSPACE_ID`
- `TapdClient.getNickName()` — `TAPD_NICK_NAME`
- `TapdClient.getDefaultStoryWorkitemTypeId()` — `TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID`
- `TapdClient.getDefaultTaskWorkitemTypeId()` — `TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID`
- `TapdClient.toLongId(id, workspaceId)` — Short ID to long ID conversion

Request methods: `client.get(path, params)` and `client.post(path, params)`.

GET requests auto-retry on 429/5xx (max 3 retries, exponential backoff). POST requests never retry.

## Conventions

### Parameter Design

- All IDs use `z.string()` — never `z.number()` — to avoid JavaScript precision loss for large TAPD IDs (> MAX_SAFE_INTEGER)
- `workspace_id` is optional in most tools; defaults to `TAPD_DEFAULT_WORKSPACE_ID` env var
- Owner/creator fields default to `TAPD_NICK_NAME` env var
- Description strings in `.describe()` use Chinese for consistency with TAPD's UI

### API Endpoint Paths

- GET endpoints: `/stories`, `/bugs`, `/tasks`, `/iterations`, etc.
- POST endpoints: same paths for create, entity ID in params for update
- Query API path: `/workitem_types` (not `/stories/workitem_types`)

### File Naming

Tool modules in `src/tools/` use kebab-case: `mini-item.ts`, `custom-fields.ts`, etc.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TAPD_ACCESS_TOKEN` | One of two | Personal access token (recommended) |
| `TAPD_API_USER` + `TAPD_API_PASSWORD` | One of two | API account + secret |
| `TAPD_API_BASE_URL` | No | API base URL, default `https://api.tapd.cn` |
| `TAPD_DEFAULT_WORKSPACE_ID` | No | Default workspace ID |
| `TAPD_NICK_NAME` | No | Default owner/creator nickname |
| `TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID` | No | Default STORY workitem type ID |
| `TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID` | No | Default TASK workitem type ID |

## Key Patterns

### workitem_type_id Resolution (tapd_create_story)

Priority chain: user parameter → env var (`TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID`) → API query (`GET /workitem_types` → find STORY type).

This enables creating TASK-type items via Story API (bypasses `tasks::create` permission requirement).

### Short ID Conversion

TAPD uses long IDs (e.g. `1139814312001000205`). Short IDs (≤9 digits) are auto-converted using `TapdClient.toLongId()` with workspace ID prefix.
