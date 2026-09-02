import { McpClient, Reporter, NO_AUTH_ENV, CLI_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';

const r = new Reporter('06-dual-entry-error');
const args = { workspace_id: WORKSPACE_ID };

// 同一命令（tapd_get_stories / story list），同一参数，均无凭证 → 比对双入口错误结构
const mcp = new McpClient({ env: NO_AUTH_ENV });
try {
  await mcp.start();
  const res = await mcp.callTool('tapd_get_stories', args);
  const mcpText = res.content?.map(c => c.text).join('') ?? '';
  const cli = await runCmd('node', [CLI_BIN, 'story', 'list', '--workspace-id', String(WORKSPACE_ID)], { env: NO_AUTH_ENV });

  const mcpIsError = res.isError === true;
  let mcpError = null;
  try { mcpError = JSON.parse(mcpText).error; } catch { /* noop */ }
  const cliMatch = /error: AUTH_MISSING: (.+)/.exec(cli.stderr);

  r.check('MCP: isError=true', mcpIsError, `实际 ${res.isError}`);
  r.check('MCP: content 为 {error: <message>} JSON（与 v1.4.2 同构）', typeof mcpError === 'string', `实际: ${mcpText.slice(0, 150)}`);
  r.check('CLI: stderr error: AUTH_MISSING: <message> 格式', Boolean(cliMatch), cli.stderr.slice(0, 150));
  r.check('CLI: 退出码 1', cli.code === 1, `实际 ${cli.code}`);

  if (mcpError && cliMatch) {
    r.check('双入口 message 语义一致（均含 Authentication required 全句）',
      mcpError.includes('Authentication required') && cliMatch[1].includes('Authentication required'),
      `MCP: ${mcpError.slice(0, 100)} | CLI: ${cliMatch[1].slice(0, 100)}`);
    r.check('双入口 message 逐字一致（同一 exec 链路证据）', mcpError === cliMatch[1],
      `MCP: ${mcpError.slice(0, 120)} | CLI: ${cliMatch[1].slice(0, 120)}`);
  }

  // 第二组：无默认 workspace 的缺失参数场景（MCP INVALID_ARGS vs CLI 侧 workspace 缺失行为）
  const mcp2 = await mcp.callTool('tapd_get_workspace_info', {});
  const mcp2Text = mcp2.content?.map(c => c.text).join('') ?? '';
  const cli2 = await runCmd('node', [CLI_BIN, 'workspace', 'info', '--workspace-id', String(WORKSPACE_ID)], { env: NO_AUTH_ENV });
  r.check('第二组 MCP tapd_get_workspace_info 无凭证 isError', mcp2.isError === true && /Authentication required/.test(mcp2Text), mcp2Text.slice(0, 120));
  r.check('第二组 CLI workspace info 无凭证同语义', cli2.code === 1 && /AUTH_MISSING.*Authentication required/.test(cli2.stderr), cli2.stderr.slice(0, 120));
} catch (e) {
  r.check('双入口错误一致性执行', false, e.message);
} finally {
  mcp.stop();
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
