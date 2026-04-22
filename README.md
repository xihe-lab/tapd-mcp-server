# TAPD MCP Server

[![CI](https://github.com/xihe-lab/tapd-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/xihe-lab/tapd-mcp-server/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@xihe-lab/tapd-mcp-server.svg)](https://www.npmjs.com/package/@xihe-lab/tapd-mcp-server)
[![license](https://img.shields.io/npm/l/@xihe-lab/tapd-mcp-server.svg)](https://github.com/xihe-lab/tapd-mcp-server/blob/main/LICENSE)
[![Node.js](https://img.shields.io/node/v/@xihe-lab/tapd-mcp-server.svg)](https://www.npmjs.com/package/@xihe-lab/tapd-mcp-server)

TAPD 是腾讯敏捷研发管理平台，覆盖需求、计划、研发、测试、发布研发全生命周期。通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 接入 Claude、Cursor 等 AI 助手，用自然语言管理需求、缺陷、任务和迭代。

## 系统要求

- Node.js >= 18.0.0
- TAPD Access Token（推荐）或 TAPD API 账号密码

## 快速开始

### 1. 获取凭证

#### 方式一：个人访问令牌（推荐）

`TAPD_ACCESS_TOKEN` 为 TAPD 个人令牌：

1. 登录 TAPD，进入 **我的设置 → 个人访问令牌**
2. 点击"创建个人访问令牌"
3. 令牌只显示一次，注意保存

#### 方式二：API 账号密码（兼容）

- 未注册：前往 [TAPD 开放平台](https://open.tapd.cn) 注册
- 已注册未授权 API：登录 TAPD，进入 **公司管理 → API账号管理**，复制 API 账号和 API 密钥

### 2. 配置 MCP 客户端

#### 方式一：一键安装命令

注意替换 `your_access_token`、`your_workspace_id` 和 `your_nick_name`：

```bash
claude mcp add -s user tapd \
  --env TAPD_ACCESS_TOKEN=your_access_token \
  --env TAPD_DEFAULT_WORKSPACE_ID=your_workspace_id \
  --env TAPD_NICK_NAME=your_nick_name \
  -- npx -y "@xihe-lab/tapd-mcp-server"
```

若忘记替换凭证，重新安装前需先卸载旧的配置：

```bash
claude mcp list
claude mcp remove tapd
```

#### 方式二：手动配置

编辑 Claude Code 的配置文件（用户目录下 `.claude.json`）：

```json
{
  "mcpServers": {
    "tapd": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/tapd-mcp-server"],
      "env": {
        "TAPD_ACCESS_TOKEN": "",
        "TAPD_API_USER": "",
        "TAPD_API_PASSWORD": "",
        "TAPD_API_BASE_URL": "https://api.tapd.cn",
        "TAPD_DEFAULT_WORKSPACE_ID": "",
        "TAPD_NICK_NAME": ""
      }
    }
  }
}
```

其他客户端配置方式：

- **Claude Desktop**：编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）
- **Cursor / VS Code**：在项目根目录创建 `.cursor/mcp.json` 或 `.vscode/mcp.json`

配置格式与上方相同。

### 3. 开始使用

配置完成后重启客户端，直接用自然语言与 AI 助手对话：

> 查看我的待办需求

> 创建一个高优先级缺陷：登录页面报 500 错误

> 当前迭代的进度怎么样

> 给任务 10001 录入 3 小时工时

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TAPD_ACCESS_TOKEN` | 二选一 | 个人访问令牌（推荐） |
| `TAPD_API_USER` + `TAPD_API_PASSWORD` | 二选一 | API 账号 + API 密钥 |
| `TAPD_API_BASE_URL` | 否 | API 基础地址，默认 `https://api.tapd.cn` |
| `TAPD_DEFAULT_WORKSPACE_ID` | 否 | 默认项目 ID，省去每次传 workspace_id |
| `TAPD_NICK_NAME` | 否 | 用户昵称，作为 owner/creator 等参数的默认值 |

注意：`TAPD_API_USER`/`TAPD_API_PASSWORD`（API 账号密码）与 `TAPD_ACCESS_TOKEN`（个人访问令牌）为两种调用方式，选一种即可。

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

## 更新

### 更新到最新版本

MCP 客户端使用 `npx` 运行时会自动下载最新版本。如需手动更新：

```bash
# 清除 npx 缓存
npx clear-cache

# 或强制使用最新版本
npx -y @xihe-lab/tapd-mcp-server@latest
```

### 查看当前版本

```bash
npm view @xihe-lab/tapd-mcp-server version
```

### 查看更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解各版本的变更内容。

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