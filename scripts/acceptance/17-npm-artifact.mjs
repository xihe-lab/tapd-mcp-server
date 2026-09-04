import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpClient, Reporter, WORKSPACE_ID, MCP_BIN, CLI_BIN } from './helpers.mjs';

// M1 发布产物链路（需求 1454）：npx 即用 / 全局安装 / 裸环境冷启动
// 被测对象只有 npm rc 包；npm 网络安装需免沙箱执行
const r = new Reporter('17-npm-artifact');
const MCP_PKG = '@xihe-lab/tapd-mcp-server@rc';
const CLI_PKG = '@xihe-lab/tapd-cli@rc';
const EXPECT_VERSION = '2.0.0-rc.1';

function sh(cmd, timeoutMs = 300_000) {
  return spawnSync('sh', ['-c', cmd], { encoding: 'utf8', timeout: timeoutMs });
}

// npm cache 有 root-owned 文件时会 EPERM，给出可操作提示而非裸失败
function npmUsable() {
  const probe = sh('npm view @xihe-lab/tapd-mcp-server version', 60_000);
  if (probe.status === 0) return true;
  r.note(`npm 不可用 (${probe.stderr?.split('\n').find(l => l.includes('EPERM')) ?? '未知错误'})`);
  r.check('npm 环境可用（~/.npm/_cacache 需 sudo chown -R $(id -u):$(id -g) ~/.npm 修复）', false);
  return false;
}

function authEnv() {
  // 凭证从真实 config 只读注入 env；写 config 的用例用 TAPD_CONFIG_PATH 副本隔离
  return { TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID) };
}

if (!npmUsable()) {
  console.log('\n[17-npm-artifact] npm 环境不可用，跳过产物链路用例');
  process.exit(1);
}

// ===== 1. dist-tag 与版本一致性 =====
const view = sh(`npm view ${MCP_PKG} version --json && npm view ${CLI_PKG} version --json`, 60_000);
const versions = view.stdout.trim().split('\n').map(s => s.replaceAll('"', ''));
r.check(`rc dist-tag 指向 ${EXPECT_VERSION} (mcp=${versions[0]} cli=${versions[1]})`,
  versions[0] === EXPECT_VERSION && versions[1] === EXPECT_VERSION);

const latestTags = sh('npm view @xihe-lab/tapd-mcp-server dist-tags.latest --json', 60_000);
r.check('latest 仍为 1.4.x（rc 不动 latest）', /"1\.4\./.test(latestTags.stdout), latestTags.stdout.trim());

// ===== 2. npx 即用：MCP stdio 握手 + 212 =====
{
  const mcp = new McpClient({ cmd: 'npx', cmdArgs: ['-y', MCP_PKG], env: authEnv() });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    r.check(`npx MCP 握手 + tools/list = 212 (实际 ${tools.length})`, tools.length === 212);
    const probe = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
    r.check('npx MCP 读调用真实出数', !probe.isError, JSON.stringify(probe).slice(0, 120));
  } finally {
    mcp.stop();
  }
}

// ===== 3. npx CLI：三级 help + version =====
{
  const help = sh(`npx -y ${CLI_PKG} --help`, 120_000);
  r.check('npx CLI --help 正常', help.status === 0 && /story/.test(help.stdout), help.stderr.slice(0, 150));
  const ver = sh(`npx -y ${CLI_PKG} --version`, 60_000);
  r.check(`npx CLI --version = ${EXPECT_VERSION}`, ver.stdout.trim() === EXPECT_VERSION, ver.stdout.trim());
}

// ===== 4. 全局安装 → TAPD_TEST_BIN 形态 =====
const gPrefix = execSync('npm prefix -g', { encoding: 'utf8' }).trim();
const gbin = `${gPrefix}/bin`;
const gi = sh(`npm i -g ${MCP_PKG} ${CLI_PKG}`, 300_000);
r.check('全局安装三包 rc 成功', gi.status === 0, gi.stderr.slice(-200));

if (gi.status === 0) {
  const mcp = new McpClient({ bin: `${gbin}/tapd-mcp-server`, env: authEnv() });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    r.check(`全局安装 MCP tools/list = 212 (实际 ${tools.length})`, tools.length === 212);
  } finally {
    mcp.stop();
  }
  const ver = spawnSync(`${gbin}/tapd`, ['--version'], { encoding: 'utf8', timeout: 30_000 });
  r.check(`全局 CLI --version = ${EXPECT_VERSION}`, ver.stdout.trim() === EXPECT_VERSION, ver.stdout.trim());
  const cfg = spawnSync('node', [CLI_BIN, 'config', 'show'], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, ...authEnv() } });
  r.note(`被测对象: TAPD_TEST_BIN=${process.env.TAPD_TEST_BIN ?? '(未设,源码态)'} / 全局 bin=${gbin}`);
  r.check('全局 CLI config show 正常（掩码输出）', cfg.status === 0 && /access_token/.test(cfg.stdout));
}

// ===== 5. 裸环境冷启动（无 ~/.tapd、无 env 凭证）=====
{
  const fakeHome = mkdtempSync(join(tmpdir(), 'tapd-rc-bare-'));
  const bareEnv = {
    HOME: fakeHome,
    TAPD_CONFIG_PATH: '/nonexistent/tapd-config-acceptance.json',
    TAPD_ACCESS_TOKEN: '',
    TAPD_API_USER: '',
    TAPD_API_PASSWORD: '',
  };
  try {
    const res = spawnSync('node', [CLI_BIN, 'story', 'list', '--workspace-id', String(WORKSPACE_ID), '--output', 'json'], {
      encoding: 'utf8', timeout: 60_000, env: { ...process.env, ...bareEnv },
    });
    r.check('裸环境 CLI 读: AUTH_MISSING 退出码 1', res.status === 1 && /AUTH_MISSING/.test(res.stderr ?? ''), `exit=${res.status}`);
    r.check('裸环境 CLI: 无 stack trace 且含配置引导（config set / env 提示）',
      !/at\s+\w+\s+\(/.test(res.stderr ?? '') && /(config set|TAPD_ACCESS_TOKEN|tapd login|凭证)/i.test(res.stderr ?? ''),
      (res.stderr ?? '').slice(0, 150));
    r.check('裸环境 CLI: stdout 管道纯净 0 字节', (res.stdout ?? '') === '');

    const mcp = new McpClient({ bin: MCP_BIN, env: bareEnv });
    try {
      await mcp.start();
      const tools = await mcp.listTools();
      r.check(`裸环境 MCP: tools/list 仍 212 (实际 ${tools.length})`, tools.length === 212);
      const call = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1 });
      r.check('裸环境 MCP: tools/call isError + 人类可读文案（无 stack）',
        call.isError === true && !/at\s+\w+\s+\(/.test(call.content?.map(c => c.text).join('') ?? ''));
    } finally {
      mcp.stop();
    }
  } finally {
    rmSync(fakeHome, { recursive: true, force: true });
  }
}

// ===== 6. 裸环境 + env token（config 优先级链路）=====
{
  const fakeHome = mkdtempSync(join(tmpdir(), 'tapd-rc-envtok-'));
  try {
    const token = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8')).access_token;
    const res = spawnSync('node', [CLI_BIN, 'story', 'list', '--workspace-id', String(WORKSPACE_ID), '--limit', '1', '--output', 'json'], {
      encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, HOME: fakeHome, TAPD_CONFIG_PATH: '/nonexistent/tapd-config-acceptance.json', TAPD_ACCESS_TOKEN: token },
    });
    r.check('无 config + env token: 正常出数（env 优先级生效）', res.status === 0, (res.stderr ?? '').slice(0, 150));
  } finally {
    rmSync(fakeHome, { recursive: true, force: true });
  }
}

const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
