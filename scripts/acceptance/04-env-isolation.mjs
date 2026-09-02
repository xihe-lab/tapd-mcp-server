import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { McpClient, Reporter, NO_AUTH_ENV, CLI_BIN, runCmd, WORKSPACE_ID } from './helpers.mjs';

const r = new Reporter('04-env-isolation');
const CONFIG_DIR = '/tmp/claude/acceptance-config';
const CONFIG_FILE = `${CONFIG_DIR}/read_only.json`;
mkdirSync(CONFIG_DIR, { recursive: true });
writeFileSync(CONFIG_FILE, JSON.stringify({
  workspace_id: WORKSPACE_ID,
  auth_mode: 'token',
  access_token: 'dummy-token-in-config',
  read_only: true,
}));
const configEnv = { ...NO_AUTH_ENV, TAPD_CONFIG_PATH: CONFIG_FILE };

// 验证点 6: 纯 env 场景 MCP 全功能语义（tools/list + tools/call 错误路径）
{
  const client = new McpClient({ env: NO_AUTH_ENV });
  try {
    await client.start();
    const tools = await client.listTools();
    r.check('纯 env (config 不存在) tools/list 正常', tools.length === 212, `实际 ${tools.length}`);
    const res = await client.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID });
    const text = res.content?.map(c => c.text).join('') ?? '';
    r.check('纯 env tools/call 错误路径 isError + Authentication required', res.isError === true && /Authentication required/.test(text),
      `输出: ${text.slice(0, 150)}`);
  } catch (e) {
    r.check('纯 env MCP 交互', false, e.message);
  } finally {
    client.stop();
  }
}

// 验证点 7: MCP 不读 config——config read_only=true 时 MCP 写工具不被拦截
{
  const client = new McpClient({ env: configEnv });
  try {
    await client.start();
    const res = await client.callTool('tapd_update_story', { id: '999999999', name: 'acceptance-probe', workspace_id: WORKSPACE_ID });
    const text = res.content?.map(c => c.text).join('') ?? '';
    const blocked = /READ_ONLY_BLOCKED|read.?only/i.test(text);
    r.check('config read_only=true 时 MCP 写工具未被拦截 (isError 但非 READ_ONLY_BLOCKED)',
      !blocked && res.isError === true, `输出: ${text.slice(0, 150)}`);
  } catch (e) {
    r.check('MCP config 隔离探测', false, e.message);
  } finally {
    client.stop();
  }
}

// 同 config 下 CLI 写命令被拦截 → 证明隔离（CLI 读 config，MCP 不读）
{
  const res = await runCmd('node', [CLI_BIN, 'story', 'update', '999999999', '--name', 'acceptance-probe', '--workspace-id', String(WORKSPACE_ID)], { env: configEnv });
  r.check('同 config 下 CLI 写命令被 READ_ONLY_BLOCKED 拦截 (退出码 1)', res.code === 1 && /READ_ONLY_BLOCKED/i.test(res.stderr),
    `退出码 ${res.code}, stderr: ${res.stderr.slice(0, 150)}`);
}

// config 文件权限 0600（FSD §7 凭证安全，走 CLI config set 写入路径）
{
  const cliConfig = `${CONFIG_DIR}/cli-written.json`;
  const res = await runCmd('node', [CLI_BIN, 'config', 'set', `access_token=dummy-cli-write-token`, 'workspace_id=' + WORKSPACE_ID], { env: { ...NO_AUTH_ENV, TAPD_CONFIG_PATH: cliConfig } });
  try {
    const mode = (statSync(cliConfig).mode & 0o777).toString(8);
    r.check(`CLI 写入 config 后权限为 600 (实际 ${mode})`, res.code === 0 && mode === '600', `退出码 ${res.code}, 权限 ${mode}, stderr: ${res.stderr.slice(0, 100)}`);
  } catch {
    r.check('CLI config set 写入 config 文件', false, `退出码 ${res.code}, stderr: ${res.stderr.slice(0, 150)}`);
  }
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
