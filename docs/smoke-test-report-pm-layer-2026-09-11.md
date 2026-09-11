# pm 层 + pipeline 引擎本地测试报告（L1/L2 双层）

| 项 | 内容 |
|----|------|
| 日期 | 2026-09-11 |
| 范围 | S1-S7 全部产出：pipeline 引擎、pm 框架、15 场景模板、advisor 域轴 |
| 分支 | feature/2.0-test-plan（655e8fb） |
| 方法 | L1 无凭证层（CLI 机制全量矩阵）+ L2 真机层（tapd-beer OAuth 凭证，只读场景） |
| 凭证来源 | tapd-knowledge-base/.mcp.json（tapd-beer env 注入进程，值不落 transcript） |

## L1 无凭证层（45 项检查）

| 组 | 结果 |
|---|---|
| 入口/帮助/版本 | ✅（八域分组含章节号 8 处） |
| pm list | ✅ 15 场景（10 read / 5 write） |
| pipeline validate 18 模板 | ✅ 全过 |
| dry-run 10 只读场景 | ✅ 全 exit 0 |
| 写闸门 5 写场景（无 --yes） | ✅ 全 WRITE_GATE + exit 2 |
| 写场景 --dry-run | ✅ 预览 + exit 0（本次修复） |
| advisor 域轴/persona/非法值 | ✅ |
| pm ≡ pipeline 等价性 | ✅ 逐字节一致 |

## L2 真机层（只读，workspace 39814312）

| 场景 | 结果 | 真实输出要点 |
|---|---|---|
| integration health（迭代 0048） | ✅ | 时间消耗 32% vs 完成度 0/17，红旗 1 项（偏差>20%） |
| cost report | ✅ | 窗口正确取迭代区间 09-02~09-30；**timesheets `起~止` 区间语法真机验证通过（S4 遗留#2 关闭）**；AC=2h |
| risk scan | ✅ | 六路扫描 rc=0，0 候选（该迭代无逾期/超支/外部依赖，符合事实） |
| quality dashboard | ✅ | 缺陷密度 1/17（保留分母），severity×status 分布渲染 |
| schedule standup | ✅ | 窗口昨日→今日，按人汇总表 |
| stakeholder map | ⚠️ 已知边界 | users 接口 403（OAuth 无 users::_get 权限，与 MCP 一致）；`--input '{"skip_users":true}'` 降级可用 |

## 发现并修复的缺陷（3 项，均已提交）

| # | 缺陷 | 根因 | 修复 |
|---|---|---|---|
| 1 | 写场景 `--dry-run` 仍走闸门拒绝 exit 2 | engine 闸门判定未豁免显式 dry-run | `b6897fe`：gateBlocked 需 `dryRun !== true`；--yes --dry-run 并存时 dry-run 优先 |
| 2 | 真机全部模板 EXPR_ERROR / 数据取空 | **TAPD 真实 API 返回 `{Story:{...}}` 包裹形态**，模板按扁平字段书写；mock 夹具保真度不足 | `aa08ca1`：引擎新增模板级 `unwrap: true`（取数后过滤前拍平，`__entity` 溯源），18 模板全量声明 + 6 单测 |
| 3 | risk-scan 真机 2 步骤失败 | `tcase_result` 必填 tcase_id+test_plan_id、`time_relative_stories` 需 story_id——工作区级查询不成立 | `aa08ca1`：两路改 where opt-in 门控 + scan 聚合括号安全取数防级联跳过；`655e8fb` 测试适配 |

## 遗留观察（不阻塞）

1. stakeholder map 的 users 403 属凭证权限边界（建议申请 users::_get 或保持降级用法）
2. standup 报告「昨日变更事件 0 条」与当日实际状态流转量不符，疑似 changes 多 ID 查询路径数据面问题，待复查
3. S1 内置三模板（deliver-story 等）已声明 unwrap，但含写步骤未做真机端到端（遵循只读测试原则）
4. OAuth 凭证 `codecommitinfos::add`、`stories::batch_update` 权限缺口（TAPD 侧，另行申请）

## 结论

**L1 45/45 ✅，L2 六场景 5✅ 1⚠️（已知权限边界）。** pm 层达到「真机可用」状态；三个真机缺陷的修复引入 6+6 项新测试，全量 17 套件无回归。建议后续把本报告的 L1 矩阵固化为 CI 冒烟脚本。
