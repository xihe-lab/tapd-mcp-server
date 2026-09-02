export type RouteKey = `${'GET' | 'POST'} ${string}`;

/**
 * SDK route table: `METHOD /path` -> @opentapd/tapd-node-sdk method name.
 * Covers every API path the 210 tool handlers call that exists in the SDK (1.68.0).
 * Unlisted paths go through the original fetch path.
 * Validate with `pnpm validate:sdk-routes` (fails on SDK upgrade drift).
 */
export const SDK_ROUTES: Partial<Record<RouteKey, string>> = {
  // attachments
  'GET /attachments': 'getAttachments',
  'GET /attachments/down': 'downloadAttachment',

  // board-cards
  'GET /board_cards': 'getBoardCards',

  // board-columns
  'GET /board_columns': 'getBoardColumns',

  // bug-changes
  'GET /bug_changes': 'getBugChanges',
  'GET /bug_changes/count': 'getBugChangesCount',

  // bugs
  'GET /bugs': 'getBugs',
  'GET /bugs/count': 'getBugsCount',
  'GET /bugs/custom_fields_settings': 'getBugCustomFieldsSettings',
  'GET /bugs/get_fields_info': 'getBugFieldsInfo',
  'GET /bugs/get_link_bugs': 'getLinkBugs',
  'GET /bugs/get_related_stories': 'getRelatedStories',
  'POST /bugs': 'addBug',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // code-commit-infos
  'GET /code_commit_infos': 'getCodeCommitInfos',

  // comments
  'GET /comments': 'getComments',
  'GET /comments/count': 'getCommentsCount',
  'POST /comments': 'addComment',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // files
  'GET /files/get_image': 'getImage',

  // iterations
  'GET /iterations': 'getIterations',
  'GET /iterations/count': 'getIterationsCount',
  'GET /iterations/custom_fields_settings': 'getIterationCustomFieldsSettings',
  'POST /iterations': 'addIteration',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // launch-accessories
  'GET /launch_accessories': 'getLaunchAccessories',

  // life-times
  'GET /life_times': 'getLifeTimes',

  // mini-item-categories
  'GET /mini_item_categories': 'getMiniItemCategories',

  // mini-item-changes
  'GET /mini_item_changes': 'getMiniItemChanges',

  // mini-items
  'GET /mini_items': 'getMiniItems',
  'GET /mini_items/count': 'getMiniItemsCount',
  'POST /mini_items': 'addMiniItem',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // releases
  'GET /releases': 'getReleases',
  'GET /releases/count': 'getReleasesCount',
  'POST /releases': 'addRelease',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // roles
  'GET /roles': 'getRoles',

  // stories
  'GET /stories': 'getStories',
  'GET /stories/count': 'getStoriesCount',
  'GET /stories/custom_fields_settings': 'getStoryCustomFieldsSettings',
  'GET /stories/get_link_stories': 'getLinkStories',
  'GET /stories/get_related_bugs': 'getStoryRelatedBugs',
  'POST /stories': 'addStory',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)
  'POST /stories/add_story_link_relations': 'addStoryLinkRelations',
  'POST /stories/change_workitem_type': 'changeWorkitemType',
  'POST /stories/remove_story_link_relation': 'removeStoryLinkRelation',

  // story-categories
  'GET /story_categories': 'getStoryCategories',
  'GET /story_categories/count': 'getStoryCategoriesCount',

  // story-changes
  'GET /story_changes': 'getStoryChanges',
  'GET /story_changes/count': 'getStoryChangesCount',

  // tapd-wikis
  'GET /tapd_wikis': 'getTapdWikis',
  'GET /tapd_wikis/count': 'getTapdWikisCount',
  'POST /tapd_wikis': 'addTapdWiki',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // tapd-wikis-attachments
  'GET /tapd_wikis_attachments/count': 'getTapdWikisAttachmentsCount',

  // tapd-wikis-drawios
  'GET /tapd_wikis_drawios': 'getTapdWikisDrawios',

  // tapd-wikis-entity-permissions
  'GET /tapd_wikis_entity_permissions': 'getTapdWikisEntityPermissions',

  // tapd-wikis-followers
  'GET /tapd_wikis_followers': 'getTapdWikisFollowers',
  'GET /tapd_wikis_followers/count': 'getTapdWikisFollowersCount',

  // tapd-wikis-tags
  'GET /tapd_wikis_tags': 'getTapdWikisTags',
  'GET /tapd_wikis_tags/count': 'getTapdWikisTagsCount',

  // task-changes
  'GET /task_changes': 'getTaskChanges',
  'GET /task_changes/count': 'getTaskChangesCount',

  // tasks
  'GET /tasks': 'getTasks',
  'GET /tasks/count': 'getTasksCount',
  'GET /tasks/custom_fields_settings': 'getTaskCustomFieldsSettings',
  'GET /tasks/get_fields_info': 'getTaskFieldsInfo',
  'POST /tasks': 'addTask',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // tcase-categories
  'GET /tcase_categories': 'getTcaseCategories',
  'GET /tcase_categories/count': 'getTcaseCategoriesCount',
  'POST /tcase_categories': 'addTcaseCategory',

  // tcase-instance
  'GET /tcase_instance/result': 'getTcaseResult',
  'POST /tcase_instance/assign': 'assignTcaseInstance',
  'POST /tcase_instance/delete_tcase_story_relation': 'deleteTcaseStoryRelation',
  'POST /tcase_instance/execute': 'executeTcaseInstance',
  'POST /tcase_instance/remove_tcase': 'removeTcaseInstance',

  // tcases
  'GET /tcases': 'getTcases',
  'GET /tcases/count': 'getTcasesCount',
  'GET /tcases/custom_fields_settings': 'getTcaseCustomFieldsSettings',
  'GET /tcases/get_fields_info': 'getTcaseFieldsInfo',
  'GET /tcases/get_story_by_tcase_id': 'getStoryByTcaseId',
  'POST /tcases': 'addTcase',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // test-plans
  'GET /test_plans': 'getTestPlans',
  'GET /test_plans/count': 'getTestPlansCount',
  'GET /test_plans/details': 'getTestPlanDetails',
  'GET /test_plans/get_fields_info': 'getTestPlanFieldsInfo',
  'GET /test_plans/get_relative_stories': 'getTestPlanRelativeStories',
  'GET /test_plans/get_test_plan_tcase': 'getTestPlanTcases',
  'GET /test_plans/progress': 'getTestPlanProgress',
  'GET /test_plans/result_relation_bugs': 'getTestPlanBugs',
  'POST /test_plans': 'addTestPlan',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)
  'POST /test_plans/create_story_relation': 'createStoryRelation',
  'POST /test_plans/create_tcase_relation': 'createTcaseRelation',
  'POST /test_plans/delete_story_relation': 'deleteStoryRelation',

  // timesheets
  'GET /timesheets': 'getTimesheets',
  'GET /timesheets/count': 'getTimesheetsCount',
  'POST /timesheets': 'addTimesheet',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

  // users
  'GET /users': 'getUsers',

  // workflows
  'GET /workflows': 'getWorkflows',
  'GET /workflows/all_transitions': 'getWorkflowAllTransitions',
  'GET /workflows/first_step': 'getWorkflowFirstStep',
  'GET /workflows/last_steps': 'getWorkflowLastSteps',
  'GET /workflows/status_map': 'getWorkflowStatusMap',

  // workitem-types
  'GET /workitem_types': 'getWorkitemTypes',

  // workspaces
  'GET /workspaces/get_workspace_info': 'getWorkspaceInfo',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)
  'GET /workspaces/sub_workspaces': 'getSubWorkspaces',
  'GET /workspaces/user_participant_projects': 'userParticipantProjects',
  'GET /workspaces/users': 'getWorkspaceUsers',  // multiple SDK methods share this path (add/update equivalent, FSD §2.4#5)

};
