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

## 影响范围（单包仓，与 labeler 自动打标对照）

- [ ] `pkg/mcp`——本仓包体改动（`src/**`：MCP Server / 工具装配）
- [ ] `pkg/repo`——仓库级（CI / 发布 / 文档 / 配置）

## 兼容性声明

- [ ] 存量工具 schema 与默认行为零变化（改了工具参数请说明）
- [ ] 与 `@xihe-lab/tapd-core` 的依赖边界未受影响（动了内核交互或富文本管道请附 round-trip 证据）
- [ ] 无破坏性变更；如有，已在 CHANGELOG **Removed/Changed** 预记

## 测试证据

- [ ] `pnpm build` / `pnpm type-check` 双绿
- [ ] 真机 e2e（涉 API 行为时必填，凭证脱敏；`pnpm test:integration` 或 MCP 客户端实测）：
  ```
  粘贴关键输出（dry-run 预览 / sha1 / 渲染验证等）
  ```

## Checklist

- [ ] 提交信息符合 `feat|fix|docs|test|chore(<TAPD短ID>): <描述>`
- [ ] 无敏感信息（token/密码一律 `***`）
- [ ] 相关文档已同步（工具描述 / README / CHANGELOG）

<!-- 代理协作产生的 PR 请保留：
🤖 Generated with [Claude Code](https://claude.com/claude-code) -->
