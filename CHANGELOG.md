# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-13

### GA 正式版

- rc 线（rc.1 ~ rc.8）全量内容；发布资产定稿（tarball 瘦身、exports/CHANGELOG 全覆盖、README 客户端配置含 WorkBuddy 专节）
- GA 前六层验证全绿（验收计划 1139814312001000019、报告 wiki 1139814312001000094）
- **latest dist-tag 自本版归位**（2.x 线接替 1.4.4 成为默认安装版）

## [2.0.0-rc.8] - 2026-09-13

### Fixed

- 版本前进对齐内核 rc.8：P0 端点参数错配修复（测试模块全链路 + 报表/代码提交/发布评审簇，bugs 0104-0108）

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-rc.7] - 2026-09-13

### Changed

- 版本前进对齐内核 rc.7：读侧无损投影（GFM 不可表达标签行内保留，`TAPD_RICHTEXT_LOSSLESS=0` 可回退有损）——智能体现在能「看见」并保真编辑 sub/sup/mark 等样式内容；HTML 旁路启发式修复（bug 0111）

## [2.0.0-rc.5] - 2026-09-13

### Fixed

- lockstep 发布管道修复后的干净首发：内部依赖精确 pin 经 `dep_pins` 通道注入子仓发布（rc.4 曾因依赖残留 caret 范围被发布后断言拦截）；无功能变化

## [2.0.0-rc.6] - 2026-09-13

### Changed

- 版本前进对齐内核 rc.6：写路径 mention 成员校验守卫（bug 0103）随内核生效——正文 `@短语` 不再误转 at-who 角标
- 发布资产体检修复：tarball 剔除测试产物（23→15 文件）、移除指向 bin 入口的误导 `main`、LICENSE 补齐标准 APPENDIX

## [2.0.0-rc.4] - 2026-09-13

### Added

- **启动版本自检**：连接后异步比对 registry @rc dist-tags，有新版经 MCP logging notification 提示「重启 MCP 会话即可更新」（TAPD_MCP_UPDATE_CHECK=off 可关；断网/镜像静默跳过）

### Changed

- 版本前进对齐家族 lockstep rc.4；依赖 @xihe-lab/tapd-core ^2.0.0-rc.4
- 发布管道升级：lockstep 原子发版 + 内部依赖精确 pin + dep_pins 注入通道

## [2.0.0-rc.3] - 2026-09-13

### Changed

- 版本前进对齐内核 rc.3：错误降级详情（智能体可直接读 hint/takeover 人工接管信息）、工具描述优化（210 工具选择更准）、只读 TTL 缓存；依赖 @xihe-lab/tapd-core ^2.0.0-rc.3

### Note

- 2.0.0-rc.2 因发布管道事故未上架 npm（mcp 包版本序列 rc.1 → rc.3），其内容（富媒体协作四件套等）均已随 rc.1/本版本可用

## [2.0.0-rc.2] - 2026-09-12

### Added

- **pm 管理语义层**（软考高项知识域 × 人机协作）：`tapd pm` 命令组八域 15 场景（整合/范围/进度/成本/质量/风险/沟通/干系人），模板即 pipeline，写场景统一闸门（TAPD 1539-1545）
- **pipeline 研发流编排引擎**：`tapd pipeline run/validate/record`，波次并发、事件流、dry-run（TAPD 1539）
- **advisor 域轴 + 角色轴**：`--persona dev|qa|pm` 意图路由，高项知识域关键词索引（TAPD 1545）
- **附件协作闭环**：`tapd_upload_attachment`（实体绑定+embed_html）/ `tapd_download_attachment`（/attachments/down 签名 URL + sha1 落盘）/ `tapd_attach_external_file`；评论与描述内嵌文件（data 五件套锚点）（TAPD 1546）
- **图片闭环**：`tapd_upload_image` + `tapd_md_to_html --upload-images` 本地图自动上传（/tfl/ 读写双向）（TAPD 1547）
- **@ 提及与保真管道**：`@昵称` md 语法 ↔ at-who 角标（服务端通知实证）、`[📎 name](attach:ws/id)` 附件引用、写工具 `raw_html` 直发旁路（TAPD 1548）
- **GitHub 自动化体系**：CI 场景路由（core/cli/mcp/meta 路径触发）、CD 三包 Trusted Publishing（OIDC 免令牌 + prerelease dist-tag 防护）、labeler/triage/stale/dependabot

### Changed

- **仓库形态**：瘦身为 mcp 单包源码仓并并入 [tapd-node](https://github.com/xihe-lab/tapd-node) 父仓聚合体系——core/cli 独立成仓以 submodule 挂载，构建/测试/发布统一在父仓流水线；本仓移除 monorepo 工具链与 CI/CD 配置（TAPD 1537 收口）

### Fixed

- pipeline `unwrap` 模板级解包 TAPD 包裹形态（{Story:{...}} 拍平，真机 L2 冒烟发现）
- 显式 `--dry-run` 豁免写闸门（预览即结果 exit 0）
- risk-scan 两路改 opt-in 门控（tcase_result/time_relative 需实体级参数）
- 1.x 附件下载 OAuth 403 回流修复（/attachments/documents_down → /attachments/down，另见 v1.4.4）

## [2.0.0-rc.1] - 2026-09-04

### Fixed

- 移植 1.4.3（feature/1.x）长 ID 精度丢失修复（TAPD 1410）：
  - 全部 260 处长 ID 参数（`id`/`story_id`/`bug_id`/`iteration_id` 等，含 optional 字段）描述追加「必须以字符串（带引号）传递」引导，从源头避免 LLM 按直觉生成 JSON 数值
  - `ToolRegistry` 注册期统一为字符串型 ID 参数包装 `z.preprocess` 防御层（MCP 与 CLI 双入口共用）：安全整数范围内的数值自动转字符串救回；超出安全范围的数值返回明确错误「请以字符串（带引号）重传」，optional/nullable 包裹形态均覆盖
  - 全量 210 工具 schema 校验：`type:"string"` 输出与 required 语义零变化，`workspace_id` 等数值型短 ID 参数行为不变

## [1.4.4] - 2026-09-11

### Fixed

- `tapd_get_attachment_download_url` 改走 `/attachments/down`——修复 OAuth 凭证下 403（原 `/attachments/documents_down` 端点需额外授权）

## [1.4.3] - 2026-09-04

### Fixed

- **长 ID 精度丢失修复（TAPD 1410）**：长 ID 参数描述追加「以字符串传递」引导 + 服务端统一预处理防御层（安全整数范围内数值自动转字符串；超范围返回明确错误），防御层覆盖 optional/nullable 包裹形态

## [1.4.1] - 2026-05-19

### Documentation

- README 更新工具数量与 `@latest` 版本号

> 1.4.2 仅含 ESLint/TypeScript 修复，发布未上架（npm 版本序列 1.4.1 → 1.4.3）

## [1.4.0] - 2026-05-19

### Added

- `tapd_create_story` 新增 `workitem_type_id` 参数，支持通过 Story API 创建 TASK 类型工作项（适合仅有 `stories::create` 权限而无 `tasks::create` 权限的场景）
- `TapdClient` 新增 `getDefaultStoryWorkitemTypeId()` 和 `getDefaultTaskWorkitemTypeId()` 静态方法，支持从环境变量读取默认 workitem_type_id
- `workitem_type_id` 自动获取逻辑：未提供时依次从用户参数 → 环境变量 → API 查询 `/workitem_types` 获取

### Environment Variables

- `TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID` - 默认 STORY 工作项类型 ID（可选）
- `TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID` - 默认 TASK 工作项类型 ID（可选）

## [1.3.0] - 2026-04-27

### Added

- `tapd_get_workflow_step_map` - 获取需求类别工作流节点信息 (新增 API 端点)

### Fixed

基于官方 TAPD API 文档，修正了以下 API 端点定义：

- **Workflow API**:
  - `tapd_get_workflow_status_map`: 添加必填参数 `system` (取值 'bug' 或 'story')
  - `tapd_get_workflow_status_map`: 参数 `workitem_type_id` 改为可选 (获取需求状态时必传)
- **Wiki API**:
  - `tapd_get_wiki_followers_count`: 端点路径修正 `/tapd_wikis/followers_count` → `/tapd_wikis_followers/count`
- **User API**:
  - `tapd_get_personal_setting`: 端点路径修正 `/users/personal_setting` → `/users/get_personal_setting`
  - `tapd_get_personal_setting`: 添加必填参数 `nick` (用户唯一标识)
  - `tapd_get_roles`: 端点路径修正 `/users/roles` → `/roles`
- **Workspace API**:
  - `tapd_get_workspace_users`: 端点路径修正 `/workspaces/get_workspace_users` → `/users`
  - `tapd_get_workspace_users`: 添加可选参数 `fields` (需要查的字段值)
- **Settings API**:
  - `tapd_get_modules`: 端点路径修正 `/settings/modules` → `/modules`
  - `tapd_get_modules`: 补充完整参数定义 (id, name, description, owner, created, limit, page, order, fields)
  - `tapd_get_versions`: 端点路径修正 `/settings/versions` → `/versions`
  - `tapd_get_versions`: 补充完整参数定义 (id, owner, creator, name, created, status, limit, page, fields)
  - `tapd_get_features`: 端点路径修正 `/settings/features` → `/features`
  - `tapd_get_features`: 补充完整参数定义 (id, name, description, owner, created, limit, page, order, fields)

### Documentation

- 同步更新 Postman Collection (Basic Auth 和 Bearer Token 版本)
- 同步更新 TAPD Wiki 文档 (ID: 1139814312001000025)

## [1.1.1] - 2026-04-24

### Fixed

- **Wiki API endpoint**: Changed GET Wiki endpoint from `/wikis` to `/tapd_wikis` to match TAPD API documentation and be consistent with POST endpoint

## [1.1.0] - 2026-04-23

### Added

- **Mini workspace tools** for TAPD 轻协作功能:
  - `tapd_mini_get_items` - 获取轻协作工作项列表
  - `tapd_mini_get_item_count` - 获取工作项数量
  - `tapd_mini_create_item` - 创建新工作项
  - `tapd_mini_update_item` - 更新工作项
  - `tapd_mini_get_comments` - 获取工作项评论
  - `tapd_mini_get_comment_count` - 获取评论数量
  - `tapd_mini_create_comment` - 创建评论
  - `tapd_mini_get_changes` - 获取工作项变更历史
  - `tapd_mini_get_categories` - 获取工作项分类
  - `tapd_mini_get_attachments` - 获取附件列表
  - `tapd_mini_get_attachment_download_url` - 获取附件下载链接
  - `tapd_mini_get_workspace_info` - 获取轻协作空间信息
  - `tapd_mini_get_workspace_users` - 获取空间成员列表
  - `tapd_mini_get_user_projects` - 获取用户参与的轻协作项目
- `tapd_create_test_plan` - 创建测试计划
- `tapd_get_test_plan_count` - 获取测试计划数量

### Changed

- Improved CI/CD pipeline with releases branch trigger workflow
- Version management now manual in package.json instead of auto-bump
- Server version updated to match package.json version

### Fixed

- Use nullish coalescing operator (`??=`) in getTapdClient function for better code style

## [1.0.6] - 2026-04-22

### Fixed

- Various CI/CD improvements and bug fixes

## [1.0.4] - 2026-04-22

### Fixed

- **ID precision loss**: Changed all ID parameter schemas from `z.number()` to `z.string()` to prevent JavaScript precision loss for large TAPD IDs (> MAX_SAFE_INTEGER)
  - Affected fields: `story_id`, `iteration_id`, `parent_id`, `ancestor_id`, `children_id`, `category_id`, `release_id`, `template_id`, `workitem_type_id`, `plan_app_id`
- **Creator default value**: Added default value for creator/reporter fields to use `TAPD_NICK_NAME` environment variable instead of token identifier (`tapd_my_token`)
  - `tapd_create_task`: Added `creator` default value
  - `tapd_create_story`: Added `creator` field and default value
  - `tapd_create_bug`: Added `reporter` default value
- **Rich text rendering**: Added newline escape handling in POST request body serialization for proper TAPD rich text format

### Added

- `tapd_batch_update_tasks`: New tool for batch updating multiple tasks (supports updating `story_id`)

## [1.0.1] - 2026-04-21

早期预发布版本（CHANGELOG 自 1.0.3 起开始记录）。

## [1.0.0] - 2026-04-21

首个 npm 发布（预发布形态，功能基线见 1.0.3 条目）。

## [1.0.3] - 2026-04-21

### Added

- Initial MCP server implementation with core TAPD API tools:
  - Stories: `tapd_get_stories`, `tapd_create_story`, `tapd_update_story`, `tapd_get_story_count`
  - Tasks: `tapd_get_tasks`, `tapd_create_task`, `tapd_update_task`, `tapd_get_task_count`
  - Bugs: `tapd_get_bugs`, `tapd_create_bug`, `tapd_update_bug`, `tapd_get_bug_count`
  - Iterations: `tapd_get_iterations`, `tapd_create_iteration`, `tapd_update_iteration`, `tapd_get_iteration_count`
  - Comments: `tapd_get_comments`, `tapd_create_comment`
  - Timesheets: `tapd_get_timesheets`, `tapd_create_timesheet`, `tapd_get_timesheet_count`
  - Test cases: `tapd_get_test_cases`
  - Test plans: `tapd_get_test_plans`
  - Wiki: `tapd_get_wikis`
  - Releases: `tapd_get_releases`
  - Workflows: `tapd_get_workflows`, `tapd_get_workflow_status_map`
  - Settings: `tapd_get_workspace_info`, `tapd_get_workspace_users`, `tapd_get_modules`, `tapd_get_features`, `tapd_get_versions`, `tapd_get_roles`, `tapd_get_personal_setting`

### Documentation

- Added README.md with installation and usage instructions
- Added CONTRIBUTING.md with development guidelines
- Added PR template for GitHub