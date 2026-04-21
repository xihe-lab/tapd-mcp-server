# TAPD MCP Server

通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 将腾讯 TAPD 接入 Claude、Cursor 等 AI 助手，用自然语言管理需求、缺陷、任务和迭代。

## 快速接入

### 1. 获取凭证

在 [TAPD 开放平台](https://open.tapd.cn) 创建应用，获取 Access Token。

### 2. 配置 MCP 客户端

需要 Node.js >= 18.0.0。无需手动安装，MCP 客户端会自动通过 npx 拉取。

#### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）：

```json
{
  "mcpServers": {
    "tapd": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/tapd-mcp-server"],
      "env": {
        "TAPD_ACCESS_TOKEN": "your_access_token",
        "TAPD_DEFAULT_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

#### Cursor / VS Code

在项目根目录创建 `.cursor/mcp.json` 或 `.vscode/mcp.json`：

```json
{
  "mcpServers": {
    "tapd": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/tapd-mcp-server"],
      "env": {
        "TAPD_ACCESS_TOKEN": "your_access_token",
        "TAPD_DEFAULT_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

#### Claude Code (CLI)

在项目 `.claude/settings.local.json` 中配置：

```json
{
  "mcpServers": {
    "tapd": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/tapd-mcp-server"],
      "env": {
        "TAPD_ACCESS_TOKEN": "your_access_token",
        "TAPD_DEFAULT_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

### 3. 开始使用

配置完成后重启客户端，直接用自然语言与 AI 助手对话：

> 查看我的待办需求

> 创建一个高优先级缺陷：登录页面报 500 错误

> 当前迭代的进度怎么样

> 给任务 10001 录入 3 小时工时

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TAPD_ACCESS_TOKEN` | 二选一 | Access Token（推荐） |
| `TAPD_API_USER` + `TAPD_API_PASSWORD` | 二选一 | 公司 ID + API Token（Basic Auth） |
| `TAPD_DEFAULT_WORKSPACE_ID` | 否 | 默认项目 ID，省去每次传 workspace_id |

## 支持的能力

| 模块 | 可用操作 | 示例 |
|------|----------|------|
| 项目 | 查询项目信息、项目列表、成员列表 | "查看我参与的项目" |
| 需求 | 查询 / 创建 / 更新需求，统计数量 | "创建需求：用户登录功能" |
| 缺陷 | 查询 / 创建 / 更新缺陷，统计数量 | "查看我的未解决 Bug" |
| 任务 | 查询 / 创建 / 更新任务，统计数量 | "把任务标记为已完成" |
| 迭代 | 查询 / 创建 / 更新迭代，统计数量 | "当前迭代还有多少未完成" |
| 工时 | 查询工时记录、录入工时、统计 | "录入 4 小时工时" |
| 评论 | 查询和创建评论 | "给这个 Bug 加评论" |
| 工作流 | 查询状态流转规则 | "需求有哪些状态" |
| 配置 | 查询模块、版本、特性 | "项目有哪些模块" |
| 测试 | 查询测试用例和测试计划 | "查看测试计划" |
| Wiki | 查询项目文档 | "查看项目 Wiki" |
| 发布 | 查询发布计划 | "查看发布计划" |
| 用户 | 查询个人设置和角色 | "我的角色是什么" |

共 **36 个工具**，覆盖 **13 个模块**。AI 助手会根据你的自然语言描述自动选择合适的工具。

## 常见问题

### AI 助手没有识别到 TAPD 工具

确认 Node.js >= 18 已安装，npx 可正常执行。修改配置后需重启客户端。

### 工具返回权限不足 (403)

在 TAPD 开放平台检查应用权限，确保已勾选所需 API 的访问权限。

### 支持 Basic Auth 吗

支持。设置 `TAPD_API_USER` 和 `TAPD_API_PASSWORD` 即可，与 Access Token 二选一。

## 本地开发

如需二次开发：

```bash
git clone git@github.com:xihe-lab/tapd-mcp-server.git && cd tapd-mcp-server
npm install && npm run build
npm run dev
```

添加新工具：在 `src/tools/` 下创建模块文件，导出 `ToolDef[]` 数组，然后在 `src/tools/index.ts` 中导入即可。

## 许可证

[Apache-2.0](LICENSE)
