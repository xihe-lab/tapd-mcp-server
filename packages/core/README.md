# @xihe-lab/tapd-core

TAPD 研发协作工具的**共享内核**：沉淀 TAPD 全部工具定义、HTTP 客户端与工具注册表，供 `@xihe-lab/tapd-cli` 与 `@xihe-lab/tapd-mcp-server` 复用。单独安装本包通常没有直接用途。

## 能力概览

- **工具定义**：`src/tools/` 按 TAPD 领域组织——需求（story）、缺陷（bug）、任务（task）、迭代（iteration）、Wiki、附件、评论、用户、工作区、发布、看板、工时、报表等，统一收敛为 `allTools`
- **HTTP 客户端**：`TapdClient`，支持 Bearer Token（`fromAccessToken`）与 Basic Auth（`fromBasicAuth`）两种认证
- **工具注册表**：`ToolRegistry`，负责工具注册、执行、审计（`AuditEvent`）与写策略裁决（`resolveWrite`）
- **配置**：`config.ts` 提供配置加载/保存与注入环境变量
- **富文本**：`richtext/` 语义库，md ↔ html 双向转换与 `@`/附件锚点处理
- **Schema 导出**：`exportSchemas` 导出工具 JSON Schema

## 依赖关系

在 pnpm workspace 中，`@xihe-lab/tapd-cli` 与 `@xihe-lab/tapd-mcp-server` 通过 `workspace:*` 依赖本包。

## 开发

```bash
pnpm --filter @xihe-lab/tapd-core build       # 编译到 dist/
pnpm --filter @xihe-lab/tapd-core type-check  # 类型检查
pnpm --filter @xihe-lab/tapd-core test        # 运行单测
```

## License

Apache-2.0
