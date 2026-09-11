## 变更摘要

<!-- 1-2 句话说明做了什么、为什么 -->

## 关联

- TAPD 需求/缺陷 ID：`1139814312001xxxxx`（无则写「无」）
- 关闭 Issue：`Closes #N`（如适用）

## 变更类型

- [ ] feature（新能力）
- [ ] bugfix
- [ ] refactor（行为不变）
- [ ] docs
- [ ] test
- [ ] ci / chore

## 影响包（分层归属，见 FSD §2）

- [ ] `pkg/core`——工具内核 / TapdClient / registry / richtext
- [ ] `pkg/cli`——命令 / pm 层 / pipeline / advisor
- [ ] `pkg/mcp`——⚠️ 勾选请说明理由（分层验收要求 mcp 业务增量 = 0）
- [ ] `pkg/repo`——monorepo / CI / 发布

## 兼容性声明

- [ ] 存量工具 schema 与默认行为零变化（改了工具参数请说明）
- [ ] D8 富文本双写策略未受影响（动了 richtext/comment 管道请附 round-trip 证据）
- [ ] 无破坏性变更；如有，已在 CHANGELOG **Removed/Changed** 预记

## 测试证据

- [ ] `pnpm -r build` / `pnpm -r type-check` 双绿
- [ ] 新增/修改测试已通过（未接线 package.json 的请在下条说明）
- [ ] 新测试已接入对应包 test 脚本
- [ ] 真机 e2e（涉 API 行为时必填，凭证脱敏）：
  ```
  粘贴关键输出（dry-run 预览 / sha1 / 渲染验证等）
  ```

## Checklist

- [ ] 提交信息符合 `feat|fix|docs|test|chore(<TAPD短ID>): <描述>`
- [ ] 无敏感信息（token/密码一律 `***`）
- [ ] 相关文档已同步（工具描述 / README / skill / CHANGELOG）

<!-- 代理协作产生的 PR 请保留：
🤖 Generated with [Claude Code](https://claude.com/claude-code) -->
