# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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