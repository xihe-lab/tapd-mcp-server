import { McpClient, Reporter, NO_CONFIG_ENV, MCP_BIN } from './helpers.mjs';
import { access } from 'node:fs/promises';

const r = new Reporter('01-mcp-bin-stdio');

const binExists = await access(MCP_BIN).then(() => true, () => false);
r.check('mcp 包 bin 产物存在 (dist/bin/tapd-mcp-server.js)', binExists);
if (!binExists) {
  r.summary();
  process.exit(1);
}

const client = new McpClient({ env: NO_CONFIG_ENV });
try {
  const init = await client.start();
  r.check('stdio initialize 握手成功', Boolean(init?.serverInfo));
  r.check(
    'serverInfo 与 v1.4.2 一致 (tapd-mcp-server / 1.0.0)',
    init?.serverInfo?.name === 'tapd-mcp-server' && init?.serverInfo?.version === '1.0.0',
    `实际: ${JSON.stringify(init?.serverInfo)}`,
  );
  r.check('协议版本返回 2024-10-07', init?.protocolVersion === '2024-10-07', `实际: ${init?.protocolVersion}`);
  const tools = await client.listTools();
  r.check('tools/list 可用', Array.isArray(tools) && tools.length > 0, `实际: ${tools?.length}`);
} catch (e) {
  r.check('stdio 交互无异常', false, e.message);
} finally {
  client.stop();
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
