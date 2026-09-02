import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { McpClient, Reporter, WORKSPACE_ID } from './helpers.mjs';

// 仓库根按脚本自身位置推导：本脚本随仓库走，worktree / 主仓均可直接跑
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CLI_BIN = `${REPO_ROOT}/packages/cli/dist/bin/tapd.js`;

// 凭证纪律：token 仅在进程内从 config.json 读出注入子进程 env，不打印明文
function readToken() {
  const config = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8'));
  if (!config.access_token) throw new Error('config.json 无 access_token');
  return config.access_token;
}

const TOKEN = readToken();
const AUTH_ENV = {
  TAPD_ACCESS_TOKEN: TOKEN,
  TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID),
  TAPD_NICK_NAME: '徐昭',
};

const r = new Reporter('16-richtext-auto');
const STAMP = Date.now();
const MD = `# zzz-delete-me-1308-${STAMP} 标题\n\n- 项一\n- 项二\n\n**加粗** \`code\`\n\n| 列A | 列B |\n|--|--|\n| 1 | 2 |`;
const HTML = `<p>zzz-delete-me-1308-${STAMP} html <strong>存量</strong></p>`;

function cliEnv(extra = {}) {
  return { TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID), ...extra };
}

async function cliJson(args, extraEnv = {}) {
  const { spawnSync } = await import('node:child_process');
  const env = { ...process.env, TAPD_ACCESS_TOKEN: TOKEN, TAPD_NICK_NAME: '徐昭', ...cliEnv(extraEnv) };
  const res = spawnSync('node', [CLI_BIN, ...args, '--output', 'json'], { encoding: 'utf8', env, timeout: 60_000 });
  if (res.status !== 0) throw new Error(`CLI 失败 (${args.join(' ')}): ${res.stderr?.slice(0, 200)}`);
  return JSON.parse(res.stdout);
}

function unwrap(data) {
  let node = data?.data ?? data;
  if (Array.isArray(node)) node = node[0];
  while (node && typeof node === 'object' && !Array.isArray(node)) {
    const vals = Object.values(node);
    if (vals.length === 1 && vals[0] && typeof vals[0] === 'object') {
      node = vals[0];
      continue;
    }
    break;
  }
  return node;
}

const MCP_BIN = `${REPO_ROOT}/packages/mcp/dist/bin/tapd-mcp-server.js`;
const mcp = new McpClient({ env: AUTH_ENV, bin: MCP_BIN });

try {
  await mcp.start();

  // ===== 写路径 1：wiki md → 服务端 markdown_description 透传 =====
  const wikiCreate = unwrap(await cliJson(['wiki', 'create', '--name', `zzz-delete-me-1308-wiki-${STAMP}`, '--description', MD]));
  r.check('W1 wiki create: description 清空', wikiCreate?.description === '' || wikiCreate?.description == null);
  r.check('W2 wiki create: markdown_description = 原始 md', wikiCreate?.markdown_description === MD);

  const wikiRaw = unwrap(await cliJson(['wiki', 'list', '--id', String(wikiCreate.id)], { TAPD_RICHTEXT_AUTO: '0' }));
  r.check('W3 wiki raw 读: 服务端保存 markdown_description 原文（透传不转）', wikiRaw?.markdown_description === MD);

  // ===== 写路径 2：story md → 客户端 markdown-it 转换入库 =====
  const storyCreate = unwrap(await cliJson(['story', 'create', '--name', `zzz-delete-me-1308-story-${STAMP}`, '--description', MD, '--owner', '徐昭']));
  const storyRaw = unwrap(await cliJson(['story', 'list', '--id', String(storyCreate.id)], { TAPD_RICHTEXT_AUTO: '0' }));
  r.check('W4 story create md: 库内为转换后 HTML（<h1> 开头 + <table>）',
    /^<h1>zzz-delete-me-1308/.test(storyRaw?.description ?? '') && /<table>/.test(storyRaw?.description ?? ''));

  // ===== 写路径 3：story HTML 输入 → 原样透传 =====
  const htmlCreate = unwrap(await cliJson(['story', 'create', '--name', `zzz-delete-me-1308-html-${STAMP}`, '--description', HTML, '--owner', '徐昭']));
  const htmlRaw = unwrap(await cliJson(['story', 'list', '--id', String(htmlCreate.id)], { TAPD_RICHTEXT_AUTO: '0' }));
  r.check('W5 story create html: 库内字节级一致（启发式识别 HTML 不重复转换）', htmlRaw?.description === HTML);

  // ===== 写路径 4：TAPD_RICHTEXT_AUTO=0 → 全原样 =====
  const offCreate = unwrap(await cliJson(['story', 'create', '--name', `zzz-delete-me-1308-off-${STAMP}`, '--description', MD, '--owner', '徐昭'], { TAPD_RICHTEXT_AUTO: '0' }));
  const offRaw = unwrap(await cliJson(['story', 'list', '--id', String(offCreate.id)], { TAPD_RICHTEXT_AUTO: '0' }));
  r.check('W6 开关关闭: md 原样入库不转换', offRaw?.description === MD);

  // ===== 读路径：开 → md；关 → 原始 HTML =====
  const storyMd = unwrap(await cliJson(['story', 'list', '--id', String(storyCreate.id)]));
  r.check('R1 读(开): description 归一为 md，gfm 表格保留',
    storyMd?.description?.includes('标题') && /列A\s*\|\s*列B/.test(storyMd?.description ?? '') && !/<h1>/.test(storyMd?.description ?? ''));

  const mcpRead = await mcp.callTool('tapd_get_stories', { workspace_id: WORKSPACE_ID, id: String(storyCreate.id), fields: 'id,description' });
  const mcpText = mcpRead.content?.map(c => c.text).join('') ?? '';
  r.check('R2 MCP 双入口一致: 读(开) 同样返回 md', mcpText.includes('标题') && /列A\s*\|\s*列B/.test(mcpText) && !mcpText.includes('<h1>'));

  const mcpOffRead = unwrap(await cliJson(['story', 'list', '--id', String(storyCreate.id)], { TAPD_RICHTEXT_AUTO: '0' }));
  r.check('R3 读(关): 返回原始 HTML', /^<h1>zzz-delete-me-1308/.test(mcpOffRead?.description ?? ''));

  // ===== 往返等价：md 写 → md 读 语义保持 =====
  const rt = storyMd?.description ?? '';
  r.check('R4 往返: 标题/列表/加粗/代码/表格 语义均在',
    rt.includes('标题') && /(\*|-)\s+项一/.test(rt) && rt.includes('**加粗**') && rt.includes('`code`') && /\|\s*1\s*\|\s*2\s*\|/.test(rt));

  // ===== MCP 写入口：tools/call 走同一 exec 管道 =====
  const mcpCreate = await mcp.callTool('tapd_create_story', { name: `zzz-delete-me-1308-mcp-${STAMP}`, description: MD, owner: '徐昭', workspace_id: WORKSPACE_ID });
  const mcpCreateText = mcpCreate.content?.map(c => c.text).join('') ?? '';
  const mcpStoryId = JSON.parse(mcpCreateText)?.Story?.id;
  const mcpStoryRaw = unwrap(await cliJson(['story', 'list', '--id', String(mcpStoryId)], { TAPD_RICHTEXT_AUTO: '0' }));
  r.check('D1 MCP 写入口: tools/call 与 CLI 同管道（库内同为转换 HTML）',
    /^<h1>zzz-delete-me-1308/.test(mcpStoryRaw?.description ?? ''));

  r.note(`测试数据（zzz-delete-me- 前缀，待手动清理）: wiki=${wikiCreate.id} stories=${storyCreate.id},${htmlCreate.id},${offCreate.id},${mcpStoryId}`);
} finally {
  mcp.stop();
}

const summary = r.summary();
process.exitCode = summary.fail > 0 ? 1 : 0;
