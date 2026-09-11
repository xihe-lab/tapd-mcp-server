# @xihe-lab/tapd-mcp-server

TAPD 的 MCP Server，让 Claude、Cursor 等 AI 助手通过自然语言管理需求、缺陷、任务和迭代。

## 快速开始

```bash
claude mcp add -s user tapd \
  --env TAPD_ACCESS_TOKEN=your_access_token \
  --env TAPD_DEFAULT_WORKSPACE_ID=your_workspace_id \
  -- npx -y "@xihe-lab/tapd-mcp-server@latest"
```

更完整的配置方式见仓库根目录 [README](../../README.md)。

## 依赖关系

本包依赖 `@xihe-lab/tapd-core`（`workspace:*`），复用其全部工具定义。

## 开发

```bash
pnpm --filter @xihe-lab/tapd-mcp-server build       # 编译到 dist/
pnpm --filter @xihe-lab/tapd-mcp-server type-check  # 类型检查
pnpm --filter @xihe-lab/tapd-mcp-server test        # integration-test，需 TAPD_ACCESS_TOKEN
```

## License

Apache-2.0
