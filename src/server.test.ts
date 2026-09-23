/**
 * P1-6（迭代 1139814312001000122 · FSD §4）：MCP 分级挂载验收测试。
 *
 * 真实 McpServer + InMemoryTransport 往返，锚定六组不变量：
 *   1. 默认启动面：tools/list = 默认集 85 工具 + discover 元工具
 *   2. discover 无参：27 个工具集枚举（id/toolCount/active/isDefault）
 *   3. discover 激活：{toolset} 即注册该域工具（tools/list 立即可见）、幂等、
 *      未知工具集报错并列出合法值
 *   4. 可见性即权限边界：未激活工具直接调用 → isError 结果含 Tool not found
 *      （SDK 1.x 将该 McpError 转为 isError 结果返回，不触达真实 handler）
 *   5. TAPD_PERMISSION_MODE=readonly：写工具不可见不可调；discover all 只激活读工具
 *   6. 会话隔离：A 会话激活不影响 B 会话（registered 闭包独立）
 */
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { allTools, TOOLSET_DEFINITIONS, resolveWrite, ToolRegistry } from '@xihe-lab/tapd-core';
import { createServer, isReadonlyMode, registerTools } from './server.js';

interface ListEntry {
  name: string;
  description: string;
}

/** 起一个真实 server 会话（client ↔ server 经 InMemory 配对传输） */
async function startSession(env: Record<string, string | undefined>): Promise<Client> {
  const server = createServer();
  const { warnings } = registerTools(server, allTools, env);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'acceptance-client', version: '0.0.0' });
  await client.connect(clientTransport);
  // 把 warnings 挂到 client 实例上供断言（不污染全局）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).__warnings = warnings;
  return client;
}

async function listTools(client: Client): Promise<ListEntry[]> {
  const res = await client.listTools();
  return res.tools as unknown as ListEntry[];
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await client.callTool({ name, arguments: args });
  // SDK ≥1.x 把 CallTool handler 抛出的 McpError（含 "Tool not found"）转成
  // isError:true 的结果返回（resolve 而非 reject）——断言走结果形态而非异常形态。
  const text = (res.content as { type: string; text: string }[])[0]?.text ?? '';
  return { text, isError: res.isError === true };
}

/** discover 返回载荷的形态（按 handler 的 textResult 分支并集建模） */
interface DiscoverPayload {
  toolsets?: { id: string; label: string; toolCount: number; active: boolean; isDefault: boolean }[];
  hint?: string;
  activated?: string;
  added?: number;
  totalTools?: number;
  error?: string;
  note?: string;
}

async function callDiscover(client: Client, args: Record<string, unknown>): Promise<{ payload: DiscoverPayload; isError: boolean }> {
  const { text, isError } = await callTool(client, 'tapd_discover_tools', args);
  return { payload: JSON.parse(text) as DiscoverPayload, isError };
}

const checks: [string, () => void | Promise<void>][] = [
  [
    'P2-1：isReadonlyMode 仅 TAPD_PERMISSION_MODE=readonly（大小写不敏感）为真',
    () => {
      assert.equal(isReadonlyMode({}), false);
      assert.equal(isReadonlyMode({ TAPD_PERMISSION_MODE: undefined }), false);
      assert.equal(isReadonlyMode({ TAPD_PERMISSION_MODE: 'rw' }), false);
      assert.equal(isReadonlyMode({ TAPD_PERMISSION_MODE: 'readonly' }), true);
      assert.equal(isReadonlyMode({ TAPD_PERMISSION_MODE: ' READONLY ' }), true);
    },
  ],
  [
    'registerTools：env 未知域告警透出（warnings 数组返回给调用方）',
    () => {
      const server = createServer();
      const { warnings } = registerTools(server, allTools, { TAPD_TOOLSETS: 'bogus' });
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /bogus/);
    },
  ],
  [
    '默认启动面：tools/list = 85 + discover = 86，含 tapd_get_stories，不含 tapd_get_wikis',
    async () => {
      const client = await startSession({});
      const tools = await listTools(client);
      assert.equal(tools.length, 86);
      const names = new Set(tools.map((t) => t.name));
      assert.ok(names.has('tapd_discover_tools'));
      assert.ok(names.has('tapd_get_stories'));
      assert.ok(names.has('tapd_md_to_html'));
      assert.ok(!names.has('tapd_get_wikis'));
      assert.ok(!names.has('tapd_create_test_case'));
      await client.close();
    },
  ],
  [
    'discover 无参：27 工具集枚举，默认集 active=true，wiki active=false，hint 在场',
    async () => {
      const client = await startSession({});
      const { payload, isError } = await callDiscover(client, {});
      assert.equal(isError, false);
      const toolsets = payload.toolsets ?? [];
      assert.equal(toolsets.length, 27);
      const wiki = toolsets.find((t) => t.id === 'wiki');
      const story = toolsets.find((t) => t.id === 'story');
      assert.ok(wiki && story, 'wiki 与 story 工具集应出现在枚举中');
      assert.equal(wiki.active, false);
      assert.equal(story.active, true);
      assert.equal(story.isDefault, true);
      assert.equal(wiki.isDefault, false);
      assert.equal(story.toolCount, TOOLSET_DEFINITIONS.find((d) => d.id === 'story')!.tools.length);
      assert.match(payload.hint ?? '', /toolset/);
      await client.close();
    },
  ],
  [
    'discover 激活：{toolset:"wiki"} 后 wiki 工具全部出现在 tools/list（幂等 added=0）',
    async () => {
      const client = await startSession({});
      const wikiDef = TOOLSET_DEFINITIONS.find((d) => d.id === 'wiki')!;
      const first = await callDiscover(client, { toolset: 'wiki' });
      assert.equal(first.isError, false);
      assert.equal(first.payload.activated, 'wiki');
      assert.ok((first.payload.added ?? 0) >= 1);
      const tools = await listTools(client);
      assert.equal(tools.length, 86 + wikiDef.tools.length);
      const names = new Set(tools.map((t) => t.name));
      for (const name of wikiDef.tools) assert.ok(names.has(name), `wiki 工具应可见: ${name}`);
      const second = await callDiscover(client, { toolset: 'WIKI' });
      assert.equal(second.payload.added, 0, '重复激活应幂等（大小写不敏感）');
      assert.equal((await listTools(client)).length, 86 + wikiDef.tools.length);
      await client.close();
    },
  ],
  [
    'discover 未知工具集：isError=true，错误信息列出全部合法 id',
    async () => {
      const client = await startSession({});
      const { payload, isError } = await callDiscover(client, { toolset: 'bogus' });
      assert.equal(isError, true);
      const message = payload.error ?? '';
      assert.match(message, /bogus/);
      for (const def of TOOLSET_DEFINITIONS) {
        assert.ok(message.includes(def.id), `合法 id ${def.id} 应出现在错误提示`);
      }
      await client.close();
    },
  ],
  [
    'discover all：一次性激活全部 216 工具',
    async () => {
      const client = await startSession({});
      const { payload } = await callDiscover(client, { toolset: 'all' });
      assert.equal(payload.totalTools, 216);
      assert.equal((await listTools(client)).length, 216 + 1);
      await client.close();
    },
  ],
  [
    '可见性即权限边界：未激活的 tapd_get_wikis 调用 → isError 结果含 Tool not found（不触达真实 handler）',
    async () => {
      const client = await startSession({});
      const res = await callTool(client, 'tapd_get_wikis');
      assert.equal(res.isError, true);
      assert.match(res.text, /not found/i);
      await client.close();
    },
  ],
  [
    'TAPD_TOOLSETS=wiki 启动：wiki 工具免 discover 直接可见',
    async () => {
      const client = await startSession({ TAPD_TOOLSETS: 'wiki' });
      const wikiDef = TOOLSET_DEFINITIONS.find((d) => d.id === 'wiki')!;
      const tools = await listTools(client);
      assert.equal(tools.length, 86 + wikiDef.tools.length);
      const names = new Set(tools.map((t) => t.name));
      assert.ok(names.has('tapd_get_wikis'));
      await client.close();
    },
  ],
  [
    'TAPD_TOOLSETS=all 启动：216 + discover = 217',
    async () => {
      const client = await startSession({ TAPD_TOOLSETS: 'all' });
      assert.equal((await listTools(client)).length, 217);
      await client.close();
    },
  ],
  [
    'readonly 档：写工具不可见、不可调（isError + not found）；读工具在场',
    async () => {
      const client = await startSession({ TAPD_PERMISSION_MODE: 'readonly' });
      const names = new Set((await listTools(client)).map((t) => t.name));
      assert.ok(!names.has('tapd_create_story'));
      assert.ok(!names.has('tapd_update_bug'));
      assert.ok(!names.has('tapd_change_workitem_type'), 'EXPLICIT_WRITE 工具（无写动词）也应被过滤');
      assert.ok(names.has('tapd_get_stories'));
      assert.ok(names.has('tapd_discover_tools'));
      const res = await callTool(client, 'tapd_create_story');
      assert.equal(res.isError, true);
      assert.match(res.text, /not found/i);
      await client.close();
    },
  ],
  [
    'readonly 档 discover all：只激活读工具（数量 = registry 视角的非写工具数）',
    async () => {
      // 以 registry 合并 EXPLICIT_WRITE 后的视角计算期望值
      const registry = new ToolRegistry();
      registry.register(allTools);
      const expected = registry.list().filter((t) => !resolveWrite(t)).length;
      const client = await startSession({ TAPD_PERMISSION_MODE: 'readonly' });
      const { payload } = await callDiscover(client, { toolset: 'all' });
      assert.equal(payload.totalTools, expected);
      assert.ok(payload.totalTools < 216);
      const names = new Set((await listTools(client)).map((t) => t.name));
      assert.ok(!names.has('tapd_create_story'));
      await client.close();
    },
  ],
  [
    'readonly 档 discover 单域：test 域只激活读工具，tapd_create_test_case 仍不可调',
    async () => {
      const client = await startSession({ TAPD_PERMISSION_MODE: 'readonly' });
      const testDef = TOOLSET_DEFINITIONS.find((d) => d.id === 'test')!;
      const { payload } = await callDiscover(client, { toolset: 'test' });
      const added = payload.added ?? 0;
      assert.ok(added >= 1);
      assert.ok(added < testDef.tools.length, 'test 域应过滤掉写工具');
      const names = new Set((await listTools(client)).map((t) => t.name));
      assert.ok(names.has('tapd_get_test_cases'));
      assert.ok(!names.has('tapd_create_test_case'));
      const res = await callTool(client, 'tapd_create_test_case');
      assert.equal(res.isError, true);
      assert.match(res.text, /not found/i);
      await client.close();
    },
  ],
  [
    '会话隔离：A 会话激活 wiki 不影响 B 会话（registered 闭包独立）',
    async () => {
      const a = await startSession({});
      await callDiscover(a, { toolset: 'wiki' });
      assert.ok((await listTools(a)).length > 86);
      const b = await startSession({});
      const bNames = new Set((await listTools(b)).map((t) => t.name));
      assert.equal(bNames.size, 86);
      assert.ok(!bNames.has('tapd_get_wikis'));
      await a.close();
      await b.close();
    },
  ],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}
if (failed > 0) {
  console.error(`---\n${failed}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`---\nall ${checks.length} checks passed`);
