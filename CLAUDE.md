# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 仓库定位

本仓是 **mcp 单包源码仓**，为 [tapd-node](https://github.com/xihe-lab/tapd-node) 父仓聚合体系的子模块（挂载于 `mcp/`）：

- 共享内核（工具定义、TapdClient、注册表、richtext 语义库）在 [xihe-lab/tapd-core](https://github.com/xihe-lab/tapd-core)
- 命令行入口在 [xihe-lab/tapd-cli](https://github.com/xihe-lab/tapd-cli)
- 构建、测试、发布统一在父仓流水线（ci.yml / cd-release.yml）

本仓**不携带工具链 devDependencies**（typescript/tsx/eslint 由 tapd-node 根承载），独立 `pnpm install` 无法完整构建——一切开发验证在父仓 checkout 中进行。

## 常用命令（在 tapd-node 父仓中执行）

```bash
pnpm --filter @xihe-lab/tapd-mcp-server build   # tsc 编译
pnpm --filter @xihe-lab/tapd-mcp-server dev     # tsx 开发模式运行
pnpm --filter @xihe-lab/tapd-mcp-server test    # 集成自检
pnpm build && pnpm test                          # 全量门禁（含 core/cli）
```

## 架构

```
src/
  bin/tapd-mcp-server.ts   # 入口，stdio transport
  server.ts                # MCP server 初始化与工具注册（工具来自 @xihe-lab/tapd-core allTools）
  integration-test.ts      # 集成自检
```

新增工具：在 tapd-core 的 `src/tools/` 添加 `ToolDef[]` 模块并合入 `tools/index.ts`；本仓只做注册与接线调整。

## 认证与环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TAPD_ACCESS_TOKEN` | 二选一 | 个人访问令牌（推荐） |
| `TAPD_API_USER` + `TAPD_API_PASSWORD` | 二选一 | API 账号 + 密钥 |
| `TAPD_API_BASE_URL` | 否 | 默认 `https://api.tapd.cn` |
| `TAPD_DEFAULT_WORKSPACE_ID` | 否 | 默认项目 ID |
| `TAPD_NICK_NAME` | 否 | owner/creator 默认值 |

## 关键约定

- TAPD 长实体 ID（19-20 位）**必须以字符串传递**（JS 精度上限 16 位）——工具描述已内置引导，registry 有 z.preprocess 防御层（core 仓）
- 描述与评论支持富媒体：`@昵称` 提及、`[📎 名称](attach:<ws>/<id>)` 附件引用、`raw_html` 直发旁路（转换管道在 core richtext 语义库）
- 发布为 npm 包 `@xihe-lab/tapd-mcp-server`，用户经 `npx -y @xihe-lab/tapd-mcp-server` 运行
