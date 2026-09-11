# GitHub 自动化工作流体系（v2：CI/CD 分类 + 场景路由 + 子仓归属）

> 设计依据：官方《Security hardening for GitHub Actions》最佳实践 + 三条架构原则（2026-09-12 定稿）：
> ① 流水线分 **CI / CD / 自动化辅助** 三层；② **场景路由**——按变更路径触发最小集合，不跑全流程；③ **子包配置随仓走**——对齐 TAPD 1537 拆仓方向（core/cli 独立成仓），本仓只保留 mcp 与集成关注点。

## 一、体系总览（三层）

### CI 类——验证代码正确性（push/PR 自动触发，场景路由）

| 场景 | 触发路径 | 执行内容 | 拆仓归属 |
|---|---|---|---|
| `ci-core.yml` | `packages/core/**`、lockfile、workspace 清单 | core 构建+类型+测试+lint+路由校验 + **下游冒烟（cli 全测）**——core 是根基 | → core 仓库（去掉冒烟） |
| `ci-cli.yml` | `packages/cli/**` | cli 构建+类型+测试+lint | → cli 仓库 |
| `ci-mcp.yml` | `packages/mcp/**`、`test/**` | mcp 构建+类型+lint+测试（凭证可选豁免） | 本仓保留 |
| `ci-meta.yml` | `.github/**`、`scripts/**`、eslint/tsconfig | actionlint + YAML 解析——**不跑构建测试** | 本仓保留 |

**不触发任何 CI 的路径**：`**/*.md`、`docs/**`（文档变更零 CI 消耗）。

### CD 类——交付产物（显式触发，全量门禁守门）

| 场景 | 触发 | 执行内容 |
|---|---|---|
| `cd-release.yml` | push `releases/<版本>` 或 dispatch（dry_run / sync_main） | 全量门禁（build/type/lint/test 全包）→ npm Trusted Publishing 发布 mcp 包 → tag → GitHub Release →（可选）同步 main |

发布门禁故意全量（不场景化）：发布是最后一道权威关卡，宁可慢不可漏。

### 自动化辅助类（后台治理）

labeler（PR 自动标签）/ triage（issue 分诊）/ stale（生命周期）/ dependabot（依赖更新）——与 CI/CD 主干解耦。

## 二、场景路由矩阵（速查）

| 你改了什么 | 触发 | 消耗 |
|---|---|---|
| 只改 md/docs | **无** | 0 |
| 只改 packages/cli | CI·cli | ~1 job |
| 只改 packages/mcp | CI·mcp | ~1 job |
| 改 packages/core（或 lockfile） | CI·core（含 cli 冒烟） | ~1 job（较长） |
| 只改 .github/scripts | CI·meta（actionlint） | 秒级 |
| push releases/<版本> | CD·release 全量门禁+发布 | 按需 |
| PR | 按改动路径触发对应 CI 场景 + labeler | 最小集 |

## 三、子仓配置归属（TAPD 1537 拆仓迁移表）

| 配置 | 本仓（mcp） | core 仓 | cli 仓 |
|---|---|---|---|
| 包级 CI | `ci-mcp.yml` | `ci-core.yml` 整体搬走（删下游冒烟段） | `ci-cli.yml` 整体搬走 |
| 包级 CD | `cd-release.yml`（mcp 发布） | 自建（Trusted Publisher 登记 core 包） | 自建 |
| 依赖更新 dependabot | 按 directory 拆三份各自维护 | 各自仓库 | 各自仓库 |
| CODEOWNERS | 本仓路径 | 各自仓库 | 各自仓库 |
| 项目级基建（labels/milestones/模板/labeler/triage/stale） | 本仓 | 仓库级自定 | 仓库级自定 |

迁移步骤（1537 落地时）：`git mv` 场景文件到子仓 → 删本仓对应文件与 paths → 本仓 core/cli 路径改为 submodule 指针监听（`paths: ['packages/core']`，submodule 指针变更即触发 mcp 集成冒烟）。

## 四、安全基线（官方指南落地清单）

1. `permissions: contents: read` 为默认，写权限按 job 显式声明
2. npm 发布走 **Trusted Publishing（OIDC）**：零 token；CI 用 `TAPD_CI_TOKEN`（可选，只读）
3. 不可信输入（PR 标题/正文、issue body）一律 `env:` 中转进脚本
4. 第三方 action 收敛至官方或事实标准

## 五、npm Trusted Publishing 配置

workflow 已适配（`id-token: write` + npm≥11.5 + 无 token）。**一次性登记（npmjs.com）**：

```
@xihe-lab/tapd-mcp-server → Settings → Trusted Publishers → Add：
  Repository:        xihe-lab/tapd-mcp-server
  Workflow filename: cd-release.yml   ← 注意新文件名（原 release.yml 已更名）
  Environment:       npm publish（可选）
```

**前置校验清单**：
- [ ] npmjs.com 登记 Trusted Publisher（文件名 cd-release.yml）
- [ ] Settings → Environments → 建 `npm publish`（可挂 required reviewers；无需 secret）
- [ ] （可选）`TAPD_CI_TOKEN`、`ISSUE_TRIAGE_ASSIGNEE`
- [ ] Actions → General → Workflow permissions → Read repository contents
- [ ] 分支保护：feature/2.0-test-plan 与 main——required checks 按场景名（`core`/`cli`/`mcp`/`meta` job 名）、禁 force push

## 六、发布双通道

- **手动通道（当前默认）**：本地门禁 → `npm publish`（v1.4.4 即此方式）
- **自动通道**：push `releases/<version>` 或 dispatch dry-run 演练 → 全自动（npm OIDC → tag → Release → 可选 sync main）
