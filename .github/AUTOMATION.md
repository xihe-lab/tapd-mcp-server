# GitHub 自动化工作流体系

> 设计依据：官方《Security hardening for GitHub Actions》最佳实践（2026-09 调研）+ 仓库现状（monorepo/pnpm/双发布线）。调研要点落地：最小权限、环境 secrets、脚本注入防护（不可信输入经 env 中转）、CODEOWNERS 护栏、Dependabot 保持 actions 更新。

## 体系总览（六条流水线）

| 流水线 | 触发 | 职责 | 状态 |
|---|---|---|---|
| **CI**（ci.yml） | push main/develop/**feature**/**releases** + 全部 PR | 质量门禁（type-check/lint/build/路由校验 ×Node 20/22）→ 单测（core+cli 必跑；mcp 凭证可选豁免） | 🔄 重写：修复 npm→pnpm 不兼容、补 feature 分支覆盖 |
| **PR 自动标签**（labeler.yml） | PR opened/synchronize | 按 `.github/labeler.yml` 路径映射自动打 `pkg/*`、`type/docs`；标题/描述含 TAPD 长 ID 自动打 `tapd/linked` | 🆕 |
| **Issue 分诊**（triage.yml） | issues opened/reopened | 表单自带 `type/*`+`flow/needs-triage`；TAPD ID 识别；可选默认分派（`ISSUE_TRIAGE_ASSIGNEE` secret） | 🆕 |
| **生命周期**（stale.yml） | 每日 09:33 | 21 天无互动 → stale，再 7 天关闭；`prio/high`/`rel/*`/`flow/blocked`/`tapd/linked` 豁免 | 🆕 |
| **发布**（release.yml） | push `releases/**` + 手动 dispatch（含 dry-run） | 全量门禁 → npm 发布（仅 mcp 包）→ GitHub Release → tag | 🔄 重写：修复空 token bug、pnpm 适配、provenance |
| **依赖更新**（dependabot.yml） | 每周一 | npm 依赖分组 PR（major 忽略对齐 1538 策略）+ actions 版本更新 | 🆕 |

## 与既有基建的咬合

- **标签**：labeler 产出的 `pkg/*` 与 PR 模板勾选互为校验；stale 复用 `flow/needs-triage`
- **Milestones**：依赖 PR 打 `rel/2.x`，triage 时归入对应 milestone
- **CODEOWNERS**：`.github/` 与 `scripts/` 改动强制 owner review（安全敏感区）
- **TAPD 双轨**：`tapd/linked` 自动识别 ⇄ TAPD 需求留痕，GitHub 只承载外部反馈与协作

## 安全基线（官方指南落地清单）

1. `permissions: contents: read` 为默认，写权限按 job 显式声明（labeler: pull-requests: write 等）
2. npm 发布走 **Trusted Publishing（OIDC）**：零 token 存储，GitHub 身份短期证明（见下方专节）；CI 用 `TAPD_CI_TOKEN`（可选，只读）
3. 不可信输入（PR 标题/正文、issue body）一律 `env:` 中转再进脚本——零 `${{ }}` 直插 shell
4. 第三方 action 数量收敛（labeler/stale/gh-release/github-script 均官方或事实标准）

## 发布凭证：npm Trusted Publishing（OIDC 免令牌）

采用 npmjs 可信发布（比 secret 方案更优：**零 token 存储、零轮换、身份由 GitHub OIDC 短期证明**，官方供应链最佳实践）。workflow 已适配（`id-token: write` + npm≥11.5 + 无任何 NODE_AUTH_TOKEN）。

**一次性配置（npmjs.com，包维护者操作）**：
- 登录 npmjs.com → `@xihe-lab/tapd-mcp-server` → Settings → **Trusted Publishers** → 登记：
  - Repository：`xihe-lab/tapd-mcp-server`
  - Workflow filename：`release.yml`
  - Environment（可选，加强绑定）：`npm publish`

**前置校验清单**：
- [ ] npmjs.com 已按上述登记 Trusted Publisher
- [ ] Settings → Environments → 建 `npm publish` 环境（可挂 required reviewers 作发布人审；无需任何 secret）
- [ ] （可选）Secrets → Actions → `TAPD_CI_TOKEN`（只读 TAPD token，启用 CI 集成测试）
- [ ] （可选）`ISSUE_TRIAGE_ASSIGNEE`（默认分派人用户名）
- [ ] Settings → Actions → General → Workflow permissions 设为 **Read repository contents**（默认只读）
- [ ] 分支保护建议（main / feature/2.0-test-plan）：required check `quality` + `test`、require CODEOWNERS review、禁止 force push

## 发布双通道说明

- **手动通道（当前默认）**：本地 `pnpm -r build` → 版本号/CHANGELOG → `npm publish`（v1.4.4 即此方式）
- **自动通道（备用）**：push `releases/<version>` 分支或 dispatch dry-run——已修复 pnpm/token 问题，随时可切换；切换前先配好 environment secrets
