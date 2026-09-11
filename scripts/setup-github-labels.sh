#!/usr/bin/env bash
# GitHub Issues/PR 标签体系初始化（幂等：已存在则更新描述与颜色）
# 用法：gh auth login 后执行  bash scripts/setup-github-labels.sh
# 设计说明见 .github/LABELS.md
set -euo pipefail

apply() { # <name> <color> <description>
  if gh label view "$1" >/dev/null 2>&1; then
    gh label edit "$1" --color "$2" --description "$3" >/dev/null
    echo "更新: $1"
  else
    gh label create "$1" --color "$2" --description "$3" >/dev/null
    echo "创建: $1"
  fi
}

# ── 类型轴（一个问题一个主类型）──────────────────────────
apply type/bug        D73A4A "缺陷：行为与预期不符"
apply type/feature    A2EEEF "新能力：新工具/新场景/新管道"
apply type/docs       0075CA "文档"
apply type/test       7057FF "测试补充与修复"
apply type/refactor   C5DEF5 "重构：行为不变的内部改进"
apply type/chore      E4E669 "构建/依赖/CI/仓库杂项"
apply type/security   B60205 "安全：依赖告警/凭证/权限"

# ── 包归属轴（分层定位，可多标）──────────────────────────
apply pkg/core        1D76DB "core 包：工具内核/TapdClient/registry/richtext"
apply pkg/cli         0E8A16 "cli 包：命令/pm 层/pipeline/advisor"
apply pkg/mcp         5319E7 "mcp 包：MCP Server 入口（分层验收要求业务增量=0）"
apply pkg/repo        999999 "仓库级：monorepo/CI/发布/文档"

# ── 优先级轴 ────────────────────────────────────────────
apply prio/high       E99695 "高：阻塞发布或核心链路"
apply prio/medium     FBCA04 "中：计划内"
apply prio/low        CCCCCC "低：有空再说"

# ── 发布线轴 ────────────────────────────────────────────
apply rel/1.x         D4C5F9 "1.x 维护线（mcp-server 1.4.x）"
apply rel/2.x         BFD4F2 "2.x 开发线（monorepo rc）"

# ── 流程轴（维护者使用）─────────────────────────────────
apply flow/needs-triage EDEDED "待分类：新入口默认标签"
apply flow/blocked      CC317C "被阻塞：等权限/上游/决策"
apply tapd/linked       006B75 "已关联 TAPD 工作项（描述或评论含长 ID）"

echo "完成。提示：issue 表单已默认带 type/* 与 flow/needs-triage。"
