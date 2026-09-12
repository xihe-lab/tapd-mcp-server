# 标签体系（Issues / PR）

五轴正交：一个问题 = **1 个类型 + 0..n 个包 + 0..1 优先级 + 0..1 发布线 + 流程标签按需**。应用脚本：`bash scripts/setup-github-labels.sh [owner/repo]`（幂等：存在则 edit，否则 create；`--prune-defaults` 顺带清理 GitHub 默认英文标签）。

| 轴 | 标签 | 用途 |
|---|---|---|
| 类型 | `type/bug` `type/feature` `type/docs` `type/test` `type/refactor` `type/chore` `type/security` | 单选；与 commit type 对应 |
| 包 | `pkg/mcp` `pkg/repo` | 多选；**单包仓轴**——`pkg/mcp` = 本仓包体改动（`src/**`），`pkg/repo` = 仓库级（CI/发布/文档/配置）。core/cli 已独立成仓（xihe-lab/tapd-core、tapd-cli），不再保留其归属标签 |
| 优先级 | `prio/high` `prio/medium` `prio/low` | 维护者定级 |
| 发布线 | `rel/1.x` `rel/2.x` | 双线并行期区分回流（如 1.4.x 下载修复）与 2.x 新能力 |
| 流程 | `flow/needs-triage` `flow/blocked` `tapd/linked` | 入口默认 / 阻塞标记 / 已关联 TAPD 工作项 |

约定：
- Issue 表单自动带 `type/* + flow/needs-triage`，triage 时补优先级/发布线
- PR 由 labeler 按路径自动打 `pkg/*`（`src/**` → `pkg/mcp`；`.github/**`、`package.json` 等 → `pkg/repo`），维护者补优先级
- `tapd/linked`：描述或评论含 TAPD 长即打——与 TAPD 需求双向可溯
- 上游内核缺陷/需求请在 tapd-core 仓提 issue；本仓只跟踪 MCP Server 侧

## Milestones（与 TAPD 迭代对齐，本仓职责视角）

| Milestone | 内容 | 期限 | 对应 |
|---|---|---|---|
| v2.0.0-rc.2 | rc.2 收尾：富媒体协作四件套（1546-1548）的 MCP 工具面收口 + 依赖清偿（runtime high / depsec） | 10-31 | TAPD 迭代 0118、rel/2.x |
| v2.0.0 | GA：audit 操作审计、浏览器 OAuth、SDK 全量对齐的 MCP 工具全映射；随基座依赖序发布（core → cli → mcp） | 11-30 | rel/2.x |

> 历史里程碑（v2.1.0 / v3.0.0）保留原状；pm 场景/pipeline/advisor 等交互增强在 tapd-cli 仓跟踪。
