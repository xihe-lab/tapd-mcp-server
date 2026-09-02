import { writeFileSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { Reporter, REPO, NO_AUTH_ENV, runCmd, CLI_BIN, McpClient } from './helpers.mjs';

const r = new Reporter('09-extensibility');
const ECHO_TOOL = `${REPO}/packages/core/src/tools/zz-acceptance-echo.ts`;
const INDEX_FILE = `${REPO}/packages/core/src/tools/index.ts`;

function sh(cmd, cwd = REPO) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 180_000, env: { ...process.env, ...NO_AUTH_ENV } });
  } catch (e) {
    throw new Error(`sh 失败 [${cmd}]: ${String(e.message).slice(0, 300)}\nSTDERR: ${String(e.stderr ?? '').slice(-500)}`);
  }
}

let restored = false;
try {
  writeFileSync(ECHO_TOOL, `import { z } from 'zod';
import type { ToolDef } from '../types.js';

const schema = z.object({
  message: z.string().describe('要回显的消息'),
});

const handler = async (_client: unknown, params: z.infer<typeof schema>) => ({ echoed: params.message });

export const echoTools: ToolDef[] = [
  { name: 'tapd_echo', description: 'Acceptance probe tool', inputSchema: schema, handler },
];
`);
  appendFileSync(INDEX_FILE, "import { echoTools } from './zz-acceptance-echo.js';\nallTools.push(...echoTools);\n");
  sh('pnpm build');
  r.note('已注入 tapd_echo 并重新 build');

  const tapd = (...args) => runCmd('node', [CLI_BIN, ...args], { env: NO_AUTH_ENV });

  const help = await tapd('--help');
  r.check('CLI 命令树自动出现 tapd echo（零接线）', /(^|\n)\s*echo(\||\s|$)/.test(help.stdout), help.stdout.split('\n').filter(l => /echo/.test(l)).join(' ; ').slice(0, 120));

  const echoHelp = await tapd('echo', 'run', '--help');
  r.check('tapd echo run --help 可用且含 --message', echoHelp.code === 0 && /--message/.test(echoHelp.stdout), `exit=${echoHelp.code} ${echoHelp.stdout.slice(0, 150)}${echoHelp.stderr.slice(0, 100)}`);

  const schema = await tapd('config', 'export-schema', '--format', 'anthropic');
  let echoInSchema = false;
  try { echoInSchema = JSON.parse(schema.stdout).some(t => t.name === 'tapd_echo'); } catch { /* noop */ }
  r.check('export-schema 自动含 tapd_echo', echoInSchema);

  const adv = await tapd('advisor', 'echo 消息回显');
  r.check('advisor 索引自动召回 echo 命令 (echo run / tapd_echo)', /echo run|tapd_echo/.test(adv.stdout), adv.stdout.slice(0, 150));

  const mcp = new McpClient({ env: NO_AUTH_ENV });
  try {
    await mcp.start();
    const tools = await mcp.listTools();
    r.check('MCP tools/list 自动含 tapd_echo (211)', tools.some(t => t.name === 'tapd_echo'), `实际 ${tools.length} 个`);
  } finally {
    mcp.stop();
  }
} catch (e) {
  r.check('可扩展性用例执行', false, e.message);
} finally {
  if (!restored) {
    try {
      execSync(`git checkout -- packages/core/src/tools/index.ts && rm -f ${ECHO_TOOL}`, { cwd: REPO });
      sh('pnpm build');
      const tools = JSON.parse(execSync(`node -e "import('${REPO}/packages/core/dist/index.js').then(m => console.log(JSON.stringify(m.allTools.map(t => t.name))))"`, { encoding: 'utf8' }));
      if (tools.length === 210) {
        r.note('仓库已恢复原状（tapd_echo 移除，210 工具基线复建）');
      } else {
        r.note(`警告: 恢复后工具数 ${tools.length}，需人工检查`);
      }
    } catch (e2) {
      r.note(`恢复失败: ${e2.message.slice(0, 200)}`);
    }
  }
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
