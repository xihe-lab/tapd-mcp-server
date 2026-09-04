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

注意替换以下参数（必填项标记为 **必填**，其余可选）。`-s user` 为用户级配置（所有项目生效），改为 `-s project` 则仅当前项目生效：

```bash
claude mcp add -s user tapd \
  --env TAPD_ACCESS_TOKEN=your_access_token \                        # 必填：个人访问令牌
  --env TAPD_DEFAULT_WORKSPACE_ID=your_workspace_id \                # 必填：默认项目 ID
  --env TAPD_NICK_NAME=your_nick_name \                              # 推荐：用户昵称，用于 owner/creator 默认值
  --env TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID=your_task_type_id \       # 可选：默认 TASK 类型 ID，可通过 tapd_get_workitem_types 查询
  --env TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID=your_story_type_id \     # 可选：默认 STORY 类型 ID
  -- npx -y "@xihe-lab/tapd-mcp-server@latest"
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
      "args": ["-y", "@xihe-lab/tapd-mcp-server@latest"],
      "env": {
        "TAPD_ACCESS_TOKEN": "",
        "TAPD_API_USER": "",
        "TAPD_API_PASSWORD": "",
        "TAPD_API_BASE_URL": "https://api.tapd.cn",
        "TAPD_DEFAULT_WORKSPACE_ID": "",
        "TAPD_NICK_NAME": "",
        "TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID": "",
        "TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID": ""
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
| `TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID` | 否 | 默认 STORY 工作项类型 ID |
| `TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID` | 否 | 默认 TASK 工作项类型 ID |

注意：`TAPD_API_USER`/`TAPD_API_PASSWORD`（API 账号密码）与 `TAPD_ACCESS_TOKEN`（个人访问令牌）为两种调用方式，选一种即可。

## 支持的能力

| 模块 | 工具数 | 可用操作 |
|------|--------|----------|
| 需求 | 28 | 查询/创建/更新/复制/批量更新需求；需求分类管理；工作项类型转换；字段信息查询；模板管理；关联缺陷/测试用例；时间关系管理 |
| 测试 | 28 | 测试用例 CRUD；测试用例分类；测试计划 CRUD；测试执行与结果；用例与计划关联管理 |
| 缺陷 | 20 | 查询/创建/更新/复制/批量更新缺陷；缺陷关联管理；字段信息查询；模板管理；变更历史 |
| 项目配置 | 21 | 模块/版本/特性/基线 CRUD；自定义字段配置；项目配置开关 |
| Wiki | 11 | 查询/创建/更新 Wiki 页面；附件/DrawIO/权限/关注者/标签管理 |
| 发布 | 11 | 发布计划 CRUD；发布评审创建与管理；评审依据管理；模板查询 |
| 项目 | 9 | 项目信息查询；成员列表；子项目；文档；日历；自定义字段；第三方项目关联 |
| 任务 | 7 | 查询/创建/更新/批量更新任务；任务变更历史 |
| 迭代 | 7 | 查询/创建/更新迭代；迭代变更历史；锁定/解锁 |
| 工作流 | 7 | 工作流定义查询；状态映射；节点信息；转换规则；首末步骤查询 |
| 自定义字段 | 7 | 需求/缺陷/任务/测试用例/迭代自定义字段配置查询；字段信息查询 |
| 轻量级项目 | 6 | 轻量级工作项查询/创建/更新；分类管理；变更历史 |
| 附件 | 5 | 附件查询/下载；轻量级项目附件管理 |
| 工时 | 5 | 工时记录查询/创建/更新/删除；工时统计 |
| 评论 | 4 | 评论查询/创建/更新；评论数量统计 |
| 用户 | 4 | 个人设置查询；角色列表；第三方用户映射；当前用户信息 |
| 变更历史 | 4 | 需求/任务变更历史查询；变更数量统计 |
| 看板 | 4 | 看板工作项创建/查询/更新；看板列查询 |
| 关联关系 | 4 | 需求关联查询/添加/删除；关联缺陷查询 |
| 工具类 | 4 | 短ID转长ID；批量获取需求/缺陷/任务详情 |
| 代码 | 3 | 代码提交记录添加/查询；提交对象详情 |
| 轻量级项目空间 | 3 | 项目信息查询；成员列表；用户项目列表 |
| 轻量级评论 | 3 | 评论查询/创建；评论数量统计 |
| 报表 | 2 | 项目报表列表；状态流转时间统计 |
| 项目集 | 2 | 项目集关联项目；项目集绑定实体 |
| 图片 | 1 | 获取图片 URL |

共 **210 个工具**，覆盖 **26 个模块**。AI 助手会根据你的自然语言描述自动选择合适的工具。

## 常见问题

### AI 助手没有识别到 TAPD 工具

确认 Node.js >= 18 已安装，npx 可正常执行。修改配置后需重启客户端。

### 工具返回权限不足 (403)

在 TAPD 开放平台检查应用权限，确保已勾选所需 API 的访问权限。

### 创建任务时提示权限不足

如果 OAuth Token 没有 `tasks::create` 权限，可以通过 `tapd_create_story` 工具传入 TASK 类型的 `workitem_type_id` 来创建任务（仅需 `stories::create` 权限）：

> 用 tapd_create_story 创建一个任务，workitem_type_id 设为 TASK 类型

可通过 `tapd_get_workitem_types` 查询项目中可用的 TASK 类型 ID。

### 调用工具报「ID 超出 JS 安全整数范围」或首次调用 ID 校验失败

TAPD 的需求/缺陷/任务等实体长 ID 为 19-20 位数字（如 `1139814312001001378`），超出 JS 安全整数上限（`Number.MAX_SAFE_INTEGER`，16 位），以 JSON 数值形式传递会丢精度导致查询为空。所有长 ID 参数必须以字符串（带引号）传递。

自 v1.4.3 起：所有工具的长 ID 参数描述已包含引导提示；若传入安全整数范围内的数值（≤16 位，如短 ID）会自动转为字符串；超出安全范围的数值会返回明确错误提示，请按提示以字符串重传。

### 支持 Basic Auth 吗

支持。设置 `TAPD_API_USER` 和 `TAPD_API_PASSWORD` 即可，与 Access Token 二选一。

## 更新

MCP 客户端使用 `npx` 运行时会自动检查并下载最新版本。如需确保使用最新版本：

### Claude Code

重新安装配置（会自动使用最新版本）：

```bash
claude mcp remove tapd
claude mcp add -s user tapd \
  --env TAPD_ACCESS_TOKEN=your_access_token \
  --env TAPD_DEFAULT_WORKSPACE_ID=your_workspace_id \
  --env TAPD_NICK_NAME=your_nick_name \
  --env TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID=your_task_type_id \
  --env TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID=your_story_type_id \
  -- npx -y "@xihe-lab/tapd-mcp-server@latest"
```

### Claude Desktop / Cursor

修改配置文件中的版本号为 `@latest` 或删除版本锁定：

```json
{
  "mcpServers": {
    "tapd": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/tapd-mcp-server@latest"],
      "env": { ... }
    }
  }
}
```

### npm 全局安装方式

如果通过 npm 全局安装使用：

```bash
# 查看当前安装版本
npm list -g @xihe-lab/tapd-mcp-server

# 更新到最新版本
npm update -g @xihe-lab/tapd-mcp-server

# 或指定版本安装
npm install -g @xihe-lab/tapd-mcp-server@1.5.0
```

更新后需重启 MCP 客户端。

### npx 缓存清理

如果 npx 使用了旧版本缓存，可手动清理后重新运行：

```bash
# 清理 npx 缓存
npx clear-npx-cache

# 或手动删除缓存目录
rm -rf ~/.npm/_npx
```

### 查看版本信息

```bash
# 查看最新发布版本
npm view @xihe-lab/tapd-mcp-server version

# 查看所有已发布版本
npm view @xihe-lab/tapd-mcp-server versions
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