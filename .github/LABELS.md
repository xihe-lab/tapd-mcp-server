# 标签体系（Issues / PR）

五轴正交：一个问题 = **1 个类型 + 1..n 个包 + 0..1 优先级 + 0..1 发布线 + 流程标签按需**。应用脚本：`bash scripts/setup-github-labels.sh`（幂等）。

| 轴 | 标签 | 用途 |
|---|---|---|
| 类型 | `type/bug` `type/feature` `type/docs` `type/test` `type/refactor` `type/chore` `type/security` | 单选；与 commit type 对应 |
| 包 | `pkg/core` `pkg/cli` `pkg/mcp` `pkg/repo` | 多选；对应 monorepo 分层（FSD §2），mcp 增量应为 0 的分层验收同源 |
| 优先级 | `prio/high` `prio/medium` `prio/low` | 维护者定级 |
| 发布线 | `rel/1.x` `rel/2.x` | 双线并行期区分回流（如 1.4.x 下载修复）与 2.x 新能力 |
| 流程 | `flow/needs-triage` `flow/blocked` `tapd/linked` | 入口默认 / 阻塞标记 / 已关联 TAPD 工作项 |

约定：
- Issue 表单自动带 `type/* + flow/needs-triage`，triage 时补包/优先级/发布线
- PR 由作者自标 `pkg/*`（模板勾选框对照），维护者补优先级
- `tapd/linked`：描述或评论含 TAPD 长即打——与 TAPD 需求双向可溯
