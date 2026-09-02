import { McpClient, Reporter, NO_AUTH_ENV, OLD_MCP_BIN, WORKSPACE_ID } from './helpers.mjs';

const r = new Reporter('03-error-behavior');
const FAKE_TOKEN = 'fake-token-for-acceptance-0000';
const fakeAuthEnv = { ...NO_AUTH_ENV, TAPD_ACCESS_TOKEN: FAKE_TOKEN };

const oldAvailable = await import('node:fs/promises')
  .then(m => m.access(OLD_MCP_BIN).then(() => true, () => false));
if (!oldAvailable) r.note(`v1.4.2 对照版不可用 (${OLD_MCP_BIN})，跳过新旧 diff`);

function extractToolResult(res) {
  // 返回 { isError, text }，兼容 JSON-RPC error 形态
  if (res?.isError !== undefined || res?.content) {
    return { isError: Boolean(res.isError), text: res.content?.map(c => c.text).join('') ?? '' };
  }
  return { isError: false, text: JSON.stringify(res) };
}

async function probe(bin, name, args, env) {
  const client = new McpClient({ env, bin });
  try {
    await client.start();
    const res = await client.callTool(name, args);
    return extractToolResult(res);
  } catch (e) {
    // JSON-RPC 层错误（如 MCP SDK 参数校验直接拒绝）也属错误行为的一种形态
    return { isError: true, text: `JSONRPC_ERROR ${e.message}` };
  } finally {
    client.stop();
  }
}

const cases = [
  {
    label: '非法参数: tapd_get_stories workspace_id="abc"',
    name: 'tapd_get_stories',
    args: { workspace_id: 'abc' },
    env: NO_AUTH_ENV,
    expect: (t) => t.isError && /workspace_id|invalid|expected|number/i.test(t.text),
  },
  {
    label: '非法参数: tapd_get_stories 缺失全部参数且无默认 workspace',
    name: 'tapd_get_stories',
    args: {},
    env: { ...NO_AUTH_ENV, TAPD_DEFAULT_WORKSPACE_ID: '' },
    expect: (t) => t.isError,
  },
  {
    label: '无凭证: tapd_get_stories',
    name: 'tapd_get_stories',
    args: { workspace_id: WORKSPACE_ID },
    env: NO_AUTH_ENV,
    expect: (t) => t.isError && /Authentication required/i.test(t.text),
  },
  {
    label: '无凭证: tapd_get_workspace_info',
    name: 'tapd_get_workspace_info',
    args: { workspace_id: WORKSPACE_ID },
    env: NO_AUTH_ENV,
    expect: (t) => t.isError && /Authentication required/i.test(t.text),
  },
  {
    label: `假 token: tapd_get_workspace_info (Bearer ${FAKE_TOKEN.slice(0, 12)}…)`,
    name: 'tapd_get_workspace_info',
    args: { workspace_id: WORKSPACE_ID },
    env: fakeAuthEnv,
    expect: (t) => t.isError && /TAPD API error|error/i.test(t.text),
  },
];

const oldResults = [];
for (const c of cases) {
  const nu = await probe(undefined, c.name, c.args, c.env);
  r.check(`新版 ${c.label} → isError + 语义匹配`, c.expect(nu), `输出: ${nu.text.slice(0, 200)}`);
  if (oldAvailable) {
    const old = await probe(OLD_MCP_BIN, c.name, c.args, c.env);
    oldResults.push({ c, nu, old });
  }
}

if (oldAvailable) {
  for (const { c, nu, old } of oldResults) {
    const bothErr = nu.isError === old.isError;
    r.check(`v1.4.2 对照 ${c.label}: isError 一致 (${old.isError})`, bothErr,
      `新版: ${nu.text.slice(0, 120)} | 旧版: ${old.text.slice(0, 120)}`);
    if (/Authentication required/i.test(nu.text) && /Authentication required/i.test(old.text)) {
      r.check(`v1.4.2 对照 ${c.label}: 无凭证文案逐字一致`, nu.text.trim() === old.text.trim(),
        `新版: ${nu.text.slice(0, 150)} | 旧版: ${old.text.slice(0, 150)}`);
    }
  }
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
