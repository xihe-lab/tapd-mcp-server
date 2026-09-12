# GitHub 自动化工作流体系（v3：单包自治发布模型）

> 设计依据：官方《Security hardening for GitHub Actions》最佳实践 + 四仓家族化定稿（2026-09-12）：
> 本仓 `xihe-lab/tapd-mcp-server` 是 **mcp 单包源码仓**（main 零工具链 devDeps），npm 包 `@xihe-lab/tapd-mcp-server` 的**原产地**——对外主交付物。
> 三条架构原则：① 流水线分 **CI 门禁 / CD 自治发布 / 自动化辅助** 三层；② **场景路由**——按变更路径触发最小集合；③ **子仓自治**——构建、发布、GitHub 配置均在本仓闭环，基座只做聚合与编排。

## 一、体系总览（三层）

### CI 门禁——验证代码正确性（PR 触发）

| 工作流 | 触发 | 执行内容 |
|---|---|---|
| `build-check.yml` | pull_request | pnpm install（`--ignore-scripts`）+ build + type-check——合入 main 的唯一门禁 |

**不触发任何 CI 的路径**：`**/*.md`、`docs/**`（文档变更零 CI 消耗）。

### CD 自治发布——交付产物（发布执行在本仓，基座只编排）

`release.yml`：构建 → OIDC 可信发布 → tag + GitHub Release，全部在本仓完成。三种触发：

| 通道 | 触发 | 门禁 |
|---|---|---|
| 单包自主发布 | push `releases/<版本>` | 校验基座 main 指针已对齐本提交 + 基座聚合 CI 在该提交上绿（`BASE_DISPATCH_TOKEN` 只读） |
| 基座编排 | 基座 `cd-release` dispatch（依赖序 core → cli → mcp） | 基座编排前已过全量门禁 |
| 手动补历史 | dispatch（version / sha） | 人工担责；npm 已发布版本自动跳过发布步，仅补 tag/Release |

依赖顺序闸内置：发布前校验 `@xihe-lab/tapd-core` 依赖范围在 npm 已可解析（core 必须先发）。

**npm Trusted Publishing 登记（一次性，npmjs.com）**：

```
@xihe-lab/tapd-mcp-server → Settings → Trusted Publishers → Add：
  Repository:        xihe-lab/tapd-mcp-server
  Workflow filename: release.yml
  Environment:       npm publish
```

### 自动化辅助类（后台治理）

| 工作流 | 作用 |
|---|---|
| `labeler.yml` | PR 自动标签：路径映射（`.github/labeler.yml`）打 `pkg/mcp` / `pkg/repo` / `type/docs`；`tapd-link` job 检测 19-20 位 TAPD 长 ID 打 `tapd/linked` |
| `triage.yml` | Issue 分诊：`tapd/linked` 检测 + 可选默认分派（secret `ISSUE_TRIAGE_ASSIGNEE`，未配置则跳过） |
| `stale.yml` | 生命周期：21 天无互动标记 `flow/needs-triage`，再 7 天关闭；`prio/high`、`rel/*`、`flow/blocked`、`tapd/linked` 豁免 |
| `dependabot.yml` | npm（weekly，major ignore，`@xihe-lab/*` ignore——内部互依版本由家族发布流水线推进）+ github-actions（major ignore） |

## 二、场景路由矩阵（速查）

| 你改了什么 | 触发 | 消耗 |
|---|---|---|
| 只改 md/docs | **无** | 0 |
| 改 `src/**` | Build Check（build+type-check） | ~1 job |
| 改 `.github/**` / 配置 | Build Check | ~1 job |
| push `releases/<版本>` | Release 自治发布（含基座指针+CI 双校验） | 按需 |
| PR 打开/更新 | Build Check + labeler | 最小集 |
| Issue 打开 | triage | 秒级 |

## 三、基座聚合体系（本仓之上）

`xihe-lab/tapd-node`（私有基座，pnpm workspace）聚合三 submodule——`tapd-core` / `tapd-cli` / `tapd-mcp-server`：

- **合并约定**：feature 分支 → PR（Build Check 门禁 + labeler 打标）→ **人审 squash 合入** → 基座 bump submodule 指针 → 基座聚合 CI 兜底（跨包集成验证）
- **发布编排**：基座 `cd-release` 按依赖序（core → cli → mcp）dispatch 各子仓 `release.yml`；各子仓也可在基座指针就绪后自主 push `releases/<版本>` 发布
- **配置归属**：labels / milestones / 模板 / labeler / triage / stale / dependabot / CODEOWNERS 均为各子仓自持一套（本文件即本仓清单）；基座只维护聚合 CI 与发布编排

## 四、安全基线（官方指南落地清单）

1. `permissions: contents: read` 为默认，写权限按 job 显式声明（Release 额外 `id-token: write`、`contents: write`）
2. npm 发布走 **Trusted Publishing（OIDC）**：零 token；发布执行锁在 `npm publish` environment（可挂 required reviewers 人审）
3. 不可信输入（PR 标题/正文、issue body）一律 `env:` 中转进脚本（labeler / triage 已落地）
4. 第三方 action 收敛至官方或事实标准（actions/checkout、actions/setup-node、pnpm/action-setup、actions/labeler、actions/github-script、actions/stale）
5. CODEOWNERS：`/.github/` 改动强制人审（`* @xuzhao` 全量兜底）

## 五、分支保护策略（2026-09-12 定稿：暂不保护是正确答案）

- `feature/**` 临时分支：**永不保护**（合入即删，Build Check 为 advisory）
- `releases/**`：不保护——发布安全由 Trusted Publisher 绑定 + environment 人审 + 版本一致性校验 + 基座指针校验多重把守
- `main`：暂不保护（单人开发）；**触发条件**：引入外部协作者/接受社区 PR 时开启（required checks + review）

## 六、维护清单

- [x] npmjs.com 登记 Trusted Publisher（@xihe-lab/tapd-mcp-server → release.yml）
- [x] Settings → Environments → `npm publish`
- [x] Actions → General → Workflow permissions → Read repository contents（默认）
- [ ] （可选）secrets：`BASE_DISPATCH_TOKEN`（基座 Contents 只读，push 触发的指针校验用）、`ISSUE_TRIAGE_ASSIGNEE`
