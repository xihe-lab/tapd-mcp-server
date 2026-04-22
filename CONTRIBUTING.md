# Contributing to TAPD MCP Server

感谢您考虑为本项目做出贡献！

---

## 开发流程

### 1. 创建分支

```bash
# 拉取最新代码
git checkout develop
git pull origin develop

# 创建功能分支
git checkout -b feature/<issue-id>-<short-desc>
```

### 2. 开发与提交

```bash
# 开发变更
npm run dev          # 开发模式运行
npm run type-check   # 类型检查
npm run lint         # 代码规范检查
npm run build        # 构建

# 提交变更
git add <files>
git commit -m "feat: add feature X"
```

### 3. 提交 Pull Request

```bash
# 推送分支
git push -u origin feature/<issue-id>-<short-desc>

# 创建 PR (base: develop)
gh pr create --base develop
```

---

## Commit 规范

使用约定式提交格式：

```
<type>: <subject>
```

### 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `ci` | CI/CD |
| `chore` | 其他杂项 |

### 示例

```bash
feat: add user authentication API
fix: resolve null pointer in tapd-client
docs: update README with installation steps
refactor: simplify tool registration logic
```

---

## PR 规范

### PR 标题

格式: `<type>: <short-description>`

示例:
- `feat: add workspace management tools`
- `fix: resolve ID precision loss issue`

### PR 描述

填写 PR 模板中的所有必要信息：
- Summary: 简要描述变更
- 变更类型:勾选对应类型
- 影响范围: 涉及的模块和是否有破坏性变更
- 测试: 确认检查项已通过

---

## 代码规范

### TypeScript

- 使用严格类型，避免 `any`
- 使用 `??` 替代 `||` 进行 nullish coalescing
- 函数参数和返回值必须有类型注解

### ESLint

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint --fix
```

---

## 测试要求

提交 PR 前确保：

- [ ] 类型检查通过 (`npm run type-check`)
- [ ] Lint 检查通过 (`npm run lint`)
- [ ] 构建通过 (`npm run build`)
- [ ] 手动测试通过（如有 API 变更）

---

## 安全规范

- **禁止提交敏感信息**: API Token、密码、密钥等
- **使用环境变量**: 通过 `.env` 文件（不提交）
- **检查 `.gitignore`**: 确保敏感文件被忽略

---

## 问题反馈

- 使用 GitHub Issues 报告 Bug 或提出功能请求
- 提供详细的问题描述和复现步骤
- 附上相关的日志或截图

---

## 代码审核

### 审核者职责

- 检查代码质量和安全性
- 确认 CI 检查通过
- 提出建设性意见
- 及时响应（24小时内）

### 被审核者职责

- 回复审核意见
- 及时修复问题
- 保持讨论礼貌和专业

---

## 许可证

本项目采用 Apache-2.0 许可证。提交的贡献将自动适用该许可证。