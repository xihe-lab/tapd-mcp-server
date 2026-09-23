# 典型工作流手册

按场景编排 `tapd-mcp-server` 工具调用的速查手册。标注规则：

- **[默认]**：2.1.0 起默认集（工作台 8 域 85 工具）内的工具，开箱即用
- **[discover]**：默认集之外的工具，需先调用 `tapd_discover_tools` 激活——无参列出全部 27 域，`{"toolset":"<id>"}` 激活对应域（幂等、免重启）；或由人在 env 配置 `TAPD_TOOLSETS=<域,…>` / `TAPD_TOOLSETS=all` 启动时挂载
- 所有 19-20 位长 ID 必须以字符串传递（JSON 中带引号）

---

## 场景 1：需求交付闭环（建需求 → 拆任务 → 提测 → 关联缺陷）

全程默认集工具，无需 discover。

1. `tapd_create_story` **[默认]** 建需求（name/description/priority/iteration_id）
2. `tapd_update_story_parent` **[默认]** 挂父子层级做 WBS 拆解；子需求用 `tapd_create_story` 逐条建（parent_id 指向父需求）
3. `tapd_create_task` **[默认]** 在需求下建任务（story_id 关联；任务型工作项也可经 `tapd_create_story` + workitem_type_id 创建）
4. 开发完成后 `tapd_update_story` **[默认]** 流转状态（先用 `tapd_get_stories` 确认当前状态；状态英文值经 `tapd_short_to_long_id` 之外的路径不可猜——工作流映射属 workflow 域，见场景 2 备注）
5. 测试发现缺陷后 `tapd_create_bug` **[默认]**（tcase_ids 可选关联用例）；`tapd_create_story_bug` **[默认]** 建需求↔缺陷关联
6. `tapd_create_comment` **[默认]** 在需求/缺陷下留验收结论（@昵称 自动转提及）

> 备注：默认集内即可完成「查状态 → 更新状态」，但状态中英文映射工具 `tapd_get_workflow_status_map` 属 workflow 域（非默认）。若依赖状态名映射，先 `tapd_discover_tools({"toolset":"workflow"})`。

## 场景 2：迭代日报 / 周报（进度 + 工时 + 缺陷存量）

需要工时与工作流两个非默认域。

1. `tapd_discover_tools` **[discover]** 无参调用，确认 timesheet / workflow 域未激活
2. `tapd_discover_tools({"toolset":"timesheet"})` 与 `{"toolset":"workflow"}` **[discover]** 激活两域
3. `tapd_get_workflow_status_map` **[discover·workflow]** 取需求/缺陷状态中英文映射（日报口径统一）
4. `tapd_get_stories` / `tapd_get_bugs` / `tapd_get_tasks` **[默认]** 按 iteration_id + modified 过滤本迭代变更面；数量口径用对应 `*_count` 工具
5. `tapd_get_timesheets` **[discover·timesheet]** 按 spentdate 区间 + iteration 实体拉工时明细
6. 汇总输出：过滤名字以 `zzz-delete-me` 开头的测试数据；统计只报覆盖范围（翻页参数 page/limit 已用满）

## 场景 3：测试计划执行（建计划 → 挂用例 → 执行记录）

需要 test 域（用例/计划/执行全在此域）。

1. `tapd_discover_tools({"toolset":"test"})` **[discover]** 激活测试域（28 工具）
2. `tapd_create_test_plan` **[discover]** 建测试计划（iteration_id 关联迭代）
3. `tapd_create_test_case` **[discover]** 建用例（name/teststeps/expectresult/precondition）；`tapd_create_tcase_relation` **[discover]** 把用例挂进计划（逐条调用更稳）
4. `tapd_create_story_tcase` **[discover]** 用例关联需求，保证覆盖追溯
5. 执行阶段 `tapd_execute_tcase_instance` **[discover]**（result: pass/fail/block，可带 bug_id 关联缺陷——缺陷创建走默认集 `tapd_create_bug`）
6. `tapd_get_test_plan_progress` **[discover]** 出通过/失败/阻塞统计；`tapd_get_test_plan_details` **[discover]** 拉逐用例明细

## 场景 4：发布评审与知识沉淀（发布计划 → 评审单 → Wiki 归档）

需要 release 与 wiki 两域。

1. `tapd_discover_tools({"toolset":"release"})` 与 `{"toolset":"wiki"}` **[discover]** 激活两域
2. `tapd_create_release` **[discover]** 建发布计划（release_date/status）
3. `tapd_get_launch_forms_templates` **[discover]** 取评审模板 ID → `tapd_add_launch_form` **[discover]** 按模板发起发布评审单
4. 版本收尾：`tapd_add_version` / `tapd_update_version` **[discover]**（2.1.0 起可用 rc tag 发版）
5. `tapd_create_wiki` **[discover]** 归档发布纪要（markdown_description 直写）；`tapd_upload_attachment` **[discover]** 挂附件（或 `tapd_attach_external_file` 只登记第三方链接）
6. 评论/通知仍走默认集 `tapd_create_comment` **[默认]**

---

## 域速查（27 域）

| 默认集（8 域 85 工具，开箱即用） | 非默认域（tapd_discover_tools 激活） |
|---|---|
| workspace(9) iteration(7) user(4) story(28) bug(20) task(7) comment(4) utility(6) | timesheet workflow settings test wiki release attachment mini-* changes custom-fields relations board source program report image media（共 131 工具） |

- 每次激活后 tools/list 即时更新（`notifications/tools/list_changed`）；重复激活幂等（added=0）
- 一次性全量：`tapd_discover_tools({"toolset":"all"})` 或启动 env `TAPD_TOOLSETS=all`
- 只读档（`TAPD_PERMISSION_MODE=readonly`）：写工具不挂载、discover 也只激活读工具
- 只加个别工具：`TAPD_TOOLS=tapd_create_release,get_wikis` 白名单并集回补
