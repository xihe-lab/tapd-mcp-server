# M7 MCP 真实客户端验证清单（需求 1454）

- 被测对象：`@xihe-lab/tapd-mcp-server@rc`（npm rc 产物，npx 即用）
- 客户端：Claude Code（真实 LLM 客户端，非脚本 JSON-RPC）
- 独立目录（U4 方案 A）：`/tmp/claude/mcp-rc-client/`，配置 `.mcp.json`，不污染工作区
- 执行方式：手工。每项填「实际/结果」，全部完成后结果回填测试报告
- 凭证纪律：任何输出不打印明文 token
- 数据约定：所有写操作实体名带 `zzz-delete-me-` 前缀，完成后登记孤儿台账 `/tmp/claude/tapd-rc-orphan-ledger.jsonl`

## 准备

```bash
mkdir -p /tmp/claude/mcp-rc-client && cd /tmp/claude/mcp-rc-client
cat > .mcp.json <<'EOF'
{
  "mcpServers": {
    "tapd-rc": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/tapd-mcp-server@rc"],
      "env": { "TAPD_DEFAULT_WORKSPACE_ID": "39814312" }
    }
  }
}
EOF
cd /tmp/claude/mcp-rc-client && claude
```

## 用例

| # | 用例 | 步骤 | 预期 | 实际 | 结果 |
|---|------|------|------|------|------|
| 1 | MCP 注册连接 | 启动后运行 `/mcp` | tapd-rc 出现且 connected，无报错 | | |
| 2 | 工具清单加载 | 让模型列出工具总数 | 212 个 tapd_* 工具 | | |
| 3 | 读调用出数 | 「查 1 条 story」 | 返回真实数据，字段完整（id/name/owner） | | |
| 4 | 写调用（带前缀） | 「创建名为 zzz-delete-me-rc23-manual 的 story」 | 创建成功；读回确认存在；实体登记孤儿台账 | | |
| 5 | 富文本写侧 | 「创建 zzz-delete-me-rc23-md story，描述用 markdown：**加粗**+换行+列表」 | TAPD 侧存 HTML（原始读回验证 <strong>），客户端读回为 md 语义 | | |
| 6 | 富文本读侧 | 「读取上一条 story 描述」 | 客户端呈现 md（**加粗**），无 `<strong>` 字面 | | |
| 7 | 长 ID 防御引导 | 「用数字 1139814312001001454 查 story」 | 报错含「超出 JS 安全整数范围」「以字符串重传」引导，无 stack | | |
| 8 | 字符串长 ID 正常 | 「用字符串 "…"（真实自建 story ID）查询」 | 命中实体，无精度截断 | | |
| 9 | 错误行为 | 临时 .mcp.json 换错误 token 重启，「查 story」 | isError + 人类可读文案（认证失败/401），无 stack trace | | |
| 10 | env 优先级 | .mcp.json env 注入有效 token（无 config 环境模拟） | 正常出数（env 优先级链路） | | |
| 11 | 工具描述质量 | 随机抽 5 个工具看 schema 描述 | 参数含义/示例清晰，模型能一次正确调用 | | |
| 12 | 大结果集 | 「查 200 条 story」 | 正常返回或明确截断提示，无崩溃/超时挂死 | | |
| 13 | 频控表现 | 连续快速发起 10+ 次调用 | 429 时客户端得到明确错误或自动退避，无未处理异常 | | |
| 14 | 会话清理 | 删除 /tmp/claude/mcp-rc-client 前先清理本清单产生的 zzz 实体 | 测试数据清零（不可清理类除外），孤儿台账同步勾销 | | |

## 记录

- 执行日期：
- 执行人：
- Claude Code 版本：
- 汇总：__/14 通过；豁免/阻塞项：
- 备注（含与脚本层 17-22 结果的差异观察）：
