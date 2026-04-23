# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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