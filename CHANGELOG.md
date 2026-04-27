# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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