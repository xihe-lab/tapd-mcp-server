#!/usr/bin/env bash
# 幂等应用五轴标签体系（见 .github/LABELS.md）到 GitHub 仓库。
# 存在则 edit（颜色/描述归一），不存在则 create。
#
# 用法：
#   bash scripts/setup-github-labels.sh [owner/repo]
#   仓库名缺省时从 origin remote 推断。
# 可选：
#   --prune-defaults   顺带删除 GitHub 默认英文标签（已删则自动跳过）
#
# 依赖：gh CLI（已登录，且对目标仓库有 write 权限）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO="$(git -C "$SCRIPT_DIR/.." remote get-url origin \
  | sed -E 's#.*([:/])([^/]+/[^/]+)(\.git)?$#\2#')"

PRUNE_DEFAULTS=0
REPO=""
for arg in "$@"; do
  case "$arg" in
    --prune-defaults) PRUNE_DEFAULTS=1 ;;
    *) REPO="$arg" ;;
  esac
done
REPO="${REPO:-$DEFAULT_REPO}"

# —— 五轴 + pkg 轴（单包化：pkg/mcp + pkg/repo）。颜色为权威定义，勿改 ——
LABELS=(
  "type/bug|D73A4A|缺陷：行为与预期不符"
  "type/feature|A2EEEF|新能力"
  "type/docs|0075CA|文档"
  "type/test|7057FF|测试补充与修复"
  "type/refactor|C5DEF5|重构：行为不变的内部改进"
  "type/chore|E4E669|构建/依赖/CI/仓库杂项"
  "type/security|B60205|安全：依赖告警/凭证/权限"
  "prio/high|E99695|高：阻塞发布或核心链路"
  "prio/medium|FBCA04|中：计划内"
  "prio/low|CCCCCC|低"
  "rel/1.x|D4C5F9|1.x 维护线"
  "rel/2.x|BFD4F2|2.x 开发线"
  "flow/needs-triage|EDEDED|待分类（issue 入口默认）"
  "flow/blocked|CC317C|被阻塞"
  "tapd/linked|006B75|已关联 TAPD 工作项（19-20 位长 ID）"
  "pkg/mcp|5319E7|本仓包体改动（MCP Server 包 src/**）"
  "pkg/repo|999999|仓库级：CI/文档/配置"
)

# GitHub 默认英文标签（家族化时一次性清理，可重复执行）
DEFAULT_LABELS=(bug documentation duplicate enhancement "good first issue" help wanted invalid question wontfix)

# 存在性判断：一次性拉取标签名清单后本地比对
# （gh 2.x 的 label 子命令没有 view；逐个探测既慢又费 API 配额）
EXISTING_LIST="$(gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name')"
have_label() {
  printf '%s\n' "$EXISTING_LIST" | grep -Fxq -- "$1"
}

apply_label() {
  local name="$1" color="$2" desc="$3"
  if have_label "$name"; then
    gh label edit "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "edit   $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "create $name"
  fi
}

echo "==> 应用五轴标签体系到 ${REPO}（共 ${#LABELS[@]} 个）"
for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color desc <<<"$entry"
  apply_label "$name" "$color" "$desc"
done

if [ "$PRUNE_DEFAULTS" -eq 1 ]; then
  echo "==> 清理默认英文标签"
  for name in "${DEFAULT_LABELS[@]}"; do
    if have_label "$name"; then
      gh label delete "$name" --repo "$REPO" --yes >/dev/null
      echo "delete $name"
    else
      echo "skip   ${name}（不存在）"
    fi
  done
fi

echo "==> 完成：${REPO}"
