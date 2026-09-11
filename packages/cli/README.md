# @xihe-lab/tapd-cli

TAPD 研发协作命令行，与 `@xihe-lab/tapd-mcp-server` 共享同一内核 `@xihe-lab/tapd-core`。

## 安装

```bash
npm install -g @xihe-lab/tapd-cli
```

## 命令体系

- **资源命令**：`tapd story` / `tapd bug` / `tapd task` / `tapd iteration` / `tapd wiki`（别名 `s` / `b` / `t` / `i` / `w`），由内核工具注册表动态生成，覆盖 TAPD 需求/缺陷/任务/迭代等读写操作
- `tapd auth` — 配置认证
- `tapd config` — 配置读写
- `tapd advisor` — 命令推荐
- `tapd pipeline` — 管道执行（模板/表达式/校验/引擎/录制）
- `tapd pm` — 研发项目管理操作（整合/范围/进度/成本/质量/资源/沟通/风险等场景）

## 开发

```bash
pnpm --filter @xihe-lab/tapd-cli build       # 编译到 dist/
pnpm --filter @xihe-lab/tapd-cli type-check  # 类型检查
pnpm --filter @xihe-lab/tapd-cli test        # 运行单测
```

## License

Apache-2.0
