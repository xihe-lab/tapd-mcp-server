import type { CliMeta } from '../types.js';

const STORY_COLUMNS = ['id', 'name', 'priority_label', 'owner', 'status'];
const BUG_COLUMNS = ['id', 'title', 'severity', 'current_owner', 'status'];
const TASK_COLUMNS = ['id', 'name', 'owner', 'status'];
const ITERATION_COLUMNS = ['id', 'name', 'startdate', 'enddate', 'status'];
const WIKI_COLUMNS = ['id', 'title', 'owner', 'created'];

export const MANUAL_CLI_META: Record<string, CliMeta> = {
  // story
  tapd_get_stories: { resource: 'story', action: 'list', outputFormat: 'table', columns: STORY_COLUMNS },
  tapd_create_story: { resource: 'story', action: 'create' },
  tapd_update_story: { resource: 'story', action: 'update', positional: 'id' },
  tapd_get_story_count: { resource: 'story', action: 'count' },
  tapd_copy_story: { resource: 'story', action: 'copy', positional: 'id' },
  tapd_batch_update_stories: { resource: 'story', action: 'batch-update' },
  tapd_get_story_categories: { resource: 'story-category', action: 'list', outputFormat: 'table' },
  tapd_get_story_categories_count: { resource: 'story-category', action: 'count' },
  tapd_add_story_category: { resource: 'story-category', action: 'create' },
  tapd_update_story_category: { resource: 'story-category', action: 'update', positional: 'id' },
  tapd_get_workitem_types: { resource: 'workitem-type', action: 'list', outputFormat: 'table' },
  tapd_change_workitem_type: { resource: 'story', action: 'set-type', positional: 'id' },
  tapd_get_story_fields_info: { resource: 'story', action: 'fields-info' },
  tapd_get_story_fields_lable: { resource: 'story', action: 'fields-lable' },
  tapd_get_story_template_list: { resource: 'story', action: 'template-list', outputFormat: 'table' },
  tapd_get_default_story_template: { resource: 'story', action: 'default-template' },
  tapd_get_story_related_bugs: { resource: 'story', action: 'related-bugs', outputFormat: 'table', columns: BUG_COLUMNS },
  tapd_create_story_bug: { resource: 'story-bug-relation', action: 'create' },
  tapd_remove_story_bug_relations: { resource: 'story-bug-relation', action: 'delete' },
  tapd_get_story_tcase: { resource: 'story-tcase-relation', action: 'list', outputFormat: 'table' },
  tapd_create_story_tcase: { resource: 'story-tcase-relation', action: 'create' },
  tapd_get_time_relative_stories: { resource: 'story-relation', action: 'list', outputFormat: 'table' },
  tapd_save_time_relations: { resource: 'story-relation', action: 'save' },
  tapd_delete_time_relations: { resource: 'story-relation', action: 'delete' },
  tapd_get_removed_stories: { resource: 'story', action: 'list-removed', outputFormat: 'table', columns: STORY_COLUMNS },
  tapd_update_story_parent: { resource: 'story', action: 'set-parent', positional: 'id' },
  tapd_get_stories_by_view_conf_id: { resource: 'story', action: 'list-by-view', outputFormat: 'table', columns: STORY_COLUMNS },
  tapd_get_story_steps: { resource: 'story', action: 'steps' },

  // bug
  tapd_get_bugs: { resource: 'bug', action: 'list', outputFormat: 'table', columns: BUG_COLUMNS },
  tapd_create_bug: { resource: 'bug', action: 'create' },
  tapd_update_bug: { resource: 'bug', action: 'update', positional: 'id' },
  tapd_get_bug_count: { resource: 'bug', action: 'count' },
  tapd_get_bug_changes: { resource: 'bug', action: 'changes', outputFormat: 'table' },
  tapd_get_bug_changes_count: { resource: 'bug', action: 'changes-count' },
  tapd_get_bug_custom_fields_settings: { resource: 'bug', action: 'custom-fields-settings' },
  tapd_get_bug_fields_info: { resource: 'bug', action: 'fields-info' },
  tapd_get_bug_fields_lable: { resource: 'bug', action: 'fields-lable' },
  tapd_get_bug_template_list: { resource: 'bug', action: 'template-list', outputFormat: 'table' },
  tapd_get_default_bug_template: { resource: 'bug', action: 'default-template' },
  tapd_batch_update_bugs: { resource: 'bug', action: 'batch-update' },
  tapd_copy_bug: { resource: 'bug', action: 'copy', positional: 'id' },
  tapd_get_link_bugs: { resource: 'bug', action: 'list-links', outputFormat: 'table' },
  tapd_link_bugs: { resource: 'bug', action: 'link' },
  tapd_delete_link_bugs: { resource: 'bug', action: 'delete-link' },
  tapd_get_related_stories: { resource: 'bug', action: 'related-stories', outputFormat: 'table', columns: STORY_COLUMNS },
  tapd_get_bugs_by_view_conf_id: { resource: 'bug', action: 'list-by-view', outputFormat: 'table', columns: BUG_COLUMNS },
  tapd_get_removed_bugs: { resource: 'bug', action: 'list-removed', outputFormat: 'table', columns: BUG_COLUMNS },
  tapd_bug_ids_to_query_token: { resource: 'bug', action: 'ids-to-query-token' },

  // task
  tapd_get_tasks: { resource: 'task', action: 'list', outputFormat: 'table', columns: TASK_COLUMNS },
  tapd_create_task: { resource: 'task', action: 'create' },
  tapd_update_task: { resource: 'task', action: 'update', positional: 'id' },
  tapd_get_task_count: { resource: 'task', action: 'count' },
  tapd_batch_update_tasks: { resource: 'task', action: 'batch-update' },
  tapd_get_removed_tasks: { resource: 'task', action: 'list-removed', outputFormat: 'table', columns: TASK_COLUMNS },
  tapd_get_tasks_by_view_conf_id: { resource: 'task', action: 'list-by-view', outputFormat: 'table', columns: TASK_COLUMNS },

  // iteration
  tapd_get_iterations: { resource: 'iteration', action: 'list', outputFormat: 'table', columns: ITERATION_COLUMNS },
  tapd_create_iteration: { resource: 'iteration', action: 'create' },
  tapd_update_iteration: { resource: 'iteration', action: 'update', positional: 'id' },
  tapd_get_iteration_count: { resource: 'iteration', action: 'count' },
  tapd_get_iteration_changes: { resource: 'iteration', action: 'changes', outputFormat: 'table' },
  tapd_lock_iteration: { resource: 'iteration', action: 'lock', positional: 'id' },
  tapd_unlock_iteration: { resource: 'iteration', action: 'unlock', positional: 'id' },

  // wiki
  tapd_get_wikis: { resource: 'wiki', action: 'list', outputFormat: 'table', columns: WIKI_COLUMNS },
  tapd_create_wiki: { resource: 'wiki', action: 'create' },
  tapd_update_wiki: { resource: 'wiki', action: 'update', positional: 'id' },
  tapd_get_wiki_count: { resource: 'wiki', action: 'count' },
  tapd_get_wiki_attachments_count: { resource: 'wiki', action: 'attachments-count' },
  tapd_get_wiki_drawios: { resource: 'wiki', action: 'drawios' },
  tapd_get_wiki_entity_permissions: { resource: 'wiki', action: 'entity-permissions' },
  tapd_get_wiki_followers: { resource: 'wiki', action: 'followers', outputFormat: 'table' },
  tapd_get_wiki_followers_count: { resource: 'wiki', action: 'followers-count' },
  tapd_get_wiki_tags: { resource: 'wiki', action: 'tags', outputFormat: 'table' },
  tapd_get_wiki_tags_count: { resource: 'wiki', action: 'tags-count' },

  // exceptions (FSD 4.1.3)
  tapd_short_to_long_id: { resource: 'id', action: 'to-long' },
  tapd_get_current_user: { resource: 'auth', action: 'whoami' },
  tapd_get_image_url: { resource: 'image', action: 'get-url' },
  tapd_md_to_html: { resource: 'md', action: 'to-html' },
  tapd_html_to_md: { resource: 'md', action: 'to-md' },
  tapd_create_comment: { resource: 'story', action: 'comment', defaults: { entry_type: 'story' } },
  tapd_get_comments: { resource: 'comment', action: 'list' },
  tapd_update_comment: { resource: 'comment', action: 'update', positional: 'id' },
  tapd_get_comments_count: { resource: 'comment', action: 'count' },
  tapd_execute_tcase_instance: { resource: 'test', action: 'execute-instance' },

  // extra exceptions: auto-derivation produces broken resource names (review finding)
  tapd_add_custom_field_config: { resource: 'custom-field-config', action: 'create' },
  tapd_update_cascade_field_options: { resource: 'custom-field-config', action: 'update-cascade-options' },
  tapd_program_relate_workspace: { resource: 'program', action: 'relate-workspace' },
  tapd_program_bind_entities: { resource: 'program', action: 'bind-entities' },
  tapd_get_attachment: { resource: 'attachment', action: 'get', positional: 'id' },
};

export const EXPLICIT_WRITE = new Set(['tapd_change_workitem_type']);
