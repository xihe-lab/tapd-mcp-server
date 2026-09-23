/**
 * update-check 单元测试：版本比较 / 开关 / registry 解析 / 提示组装 / 端到端注入
 * 运行：tsx src/update-check.test.ts（零网络依赖，registry 探针全部注入 mock）
 */

import assert from 'node:assert/strict';
import {
  buildUpdateNotice,
  checkForUpdate,
  compareVersions,
  fetchRcVersion,
  isUpdateCheckDisabled,
  packumentUrl,
  readLocalVersions,
  resolveRegistryBase,
} from './update-check.js';

const checks: [string, () => Promise<void> | void][] = [
  // ---- 版本比较 ----
  ['compareVersions: 相同版本为 0', () => {
    assert.equal(compareVersions('2.0.0-rc.3', '2.0.0-rc.3'), 0);
  }],
  ['compareVersions: rc 序号按数值比较（rc.3 < rc.10）', () => {
    assert.equal(compareVersions('2.0.0-rc.3', '2.0.0-rc.10'), -1);
    assert.equal(compareVersions('2.0.0-rc.10', '2.0.0-rc.3'), 1);
  }],
  ['compareVersions: GA > 同号 rc', () => {
    assert.equal(compareVersions('2.0.0', '2.0.0-rc.5'), 1);
    assert.equal(compareVersions('2.0.0-rc.5', '2.0.0'), -1);
  }],
  ['compareVersions: 主次补丁位决定先后', () => {
    assert.equal(compareVersions('1.4.4', '2.0.0-rc.3'), -1);
    assert.equal(compareVersions('2.0.0-rc.3', '2.1.0-rc.1'), -1);
    assert.equal(compareVersions('2.0.1-rc.1', '2.0.0-rc.9'), 1);
  }],
  ['compareVersions: 无法解析不产生结论', () => {
    assert.equal(compareVersions('not-a-version', '2.0.0-rc.3'), 0);
    assert.equal(compareVersions('2.0.0-rc.3', ''), 0);
  }],

  // ---- 环境开关 ----
  ['isUpdateCheckDisabled: 默认开启', () => {
    assert.equal(isUpdateCheckDisabled({}), false);
    assert.equal(isUpdateCheckDisabled({ TAPD_MCP_UPDATE_CHECK: 'on' }), false);
    assert.equal(isUpdateCheckDisabled({ TAPD_MCP_UPDATE_CHECK: '' }), false);
  }],
  ['isUpdateCheckDisabled: off/false/0（含大小写与空白）关闭', () => {
    assert.equal(isUpdateCheckDisabled({ TAPD_MCP_UPDATE_CHECK: 'off' }), true);
    assert.equal(isUpdateCheckDisabled({ TAPD_MCP_UPDATE_CHECK: ' OFF ' }), true);
    assert.equal(isUpdateCheckDisabled({ TAPD_MCP_UPDATE_CHECK: 'false' }), true);
    assert.equal(isUpdateCheckDisabled({ TAPD_MCP_UPDATE_CHECK: '0' }), true);
  }],

  // ---- registry 解析 ----
  ['resolveRegistryBase: 缺省 npmjs，尊重 npm_config_registry 并去尾斜杠', () => {
    assert.equal(resolveRegistryBase({}), 'https://registry.npmjs.org');
    assert.equal(
      resolveRegistryBase({ npm_config_registry: 'https://registry.npmmirror.com/' }),
      'https://registry.npmmirror.com',
    );
    assert.equal(
      resolveRegistryBase({ NPM_CONFIG_REGISTRY: 'https://mirror.example.com/api' }),
      'https://mirror.example.com/api',
    );
    assert.equal(resolveRegistryBase({ npm_config_registry: '   ' }), 'https://registry.npmjs.org');
  }],
  ['packumentUrl: scope 斜杠编码为 %2F', () => {
    assert.equal(
      packumentUrl('https://registry.npmjs.org', '@xihe-lab/tapd-core'),
      'https://registry.npmjs.org/@xihe-lab%2Ftapd-core',
    );
  }],

  // ---- 本地版本解析 ----
  ['readLocalVersions: 能从本模块定位自身 package.json', () => {
    const local = readLocalVersions(import.meta.url);
    assert.ok(local !== null, '应能解析自身版本');
    assert.match(local.server ?? '', /^\d+\.\d+\.\d+/);
    // 工作区（symlink）/npx 树均可解析；独立无 node_modules 的检出允许为 null
    if (local.core !== null) assert.match(local.core, /^\d+\.\d+\.\d+/);
  }],

  // ---- 提示组装 ----
  ['buildUpdateNotice: 双双落后时合并提示并给重启指引', () => {
    const notice = buildUpdateNotice(
      { server: '2.0.0-rc.3', core: '2.0.0-rc.3' },
      { server: '2.0.0-rc.5', core: '2.0.0-rc.5' },
    );
    assert.ok(notice !== null);
    assert.match(notice, /tapd-mcp-server 有新版本可用（2\.0\.0-rc\.3 → 2\.0\.0-rc\.5）/);
    assert.match(notice, /tapd-core 有新版本可用（2\.0\.0-rc\.3 → 2\.0\.0-rc\.5）/);
    assert.match(notice, /重启 MCP 会话即可更新/);
  }],
  ['buildUpdateNotice: 仅内核落后时只提内核', () => {
    const notice = buildUpdateNotice(
      { server: '2.0.0-rc.5', core: '2.0.0-rc.3' },
      { server: '2.0.0-rc.5', core: '2.0.0-rc.4' },
    );
    assert.ok(notice !== null);
    assert.match(notice, /tapd-core 有新版本可用/);
    assert.doesNotMatch(notice, /tapd-mcp-server 有新版本/);
  }],
  ['buildUpdateNotice: 已是最新时返回 null', () => {
    assert.equal(
      buildUpdateNotice(
        { server: '2.0.0-rc.5', core: '2.0.0-rc.5' },
        { server: '2.0.0-rc.5', core: '2.0.0-rc.5' },
      ),
      null,
    );
    assert.equal(
      buildUpdateNotice(
        { server: '2.0.0-rc.5', core: '2.0.0-rc.5' },
        { server: null, core: null },
      ),
      null,
    );
  }],
  ['buildUpdateNotice: 本地解析不到内核时仍提示 registry 版本', () => {
    const notice = buildUpdateNotice(
      { server: '2.0.0-rc.3', core: null },
      { server: null, core: '2.0.0-rc.9' },
    );
    assert.ok(notice !== null);
    assert.match(notice, /tapd-core 有新版本可用（2\.0\.0-rc\.9）/);
  }],

  // ---- 端到端（注入探针与出口） ----
  ['checkForUpdate: 有更新时经 notify 发出一条提示', async () => {
    const messages: string[] = [];
    await checkForUpdate({
      env: {},
      fromUrl: import.meta.url,
      fetchRc: (name) => (name === '@xihe-lab/tapd-core' ? '2.0.3' : null),
      notify: (message) => {
        messages.push(message);
      },
    });
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? '', /重启 MCP 会话即可更新/);
  }],
  ['checkForUpdate: TAPD_MCP_UPDATE_CHECK=off 时不探查不提示', async () => {
    let probed = 0;
    const messages: string[] = [];
    await checkForUpdate({
      env: { TAPD_MCP_UPDATE_CHECK: 'off' },
      fromUrl: import.meta.url,
      fetchRc: () => {
        probed += 1;
        return '2.0.3';
      },
      notify: (message) => {
        messages.push(message);
      },
    });
    assert.equal(probed, 0);
    assert.equal(messages.length, 0);
  }],
  ['checkForUpdate: registry 全部不可达时静默跳过', async () => {
    const messages: string[] = [];
    await checkForUpdate({
      env: {},
      fromUrl: import.meta.url,
      fetchRc: () => null,
      notify: (message) => {
        messages.push(message);
      },
    });
    assert.equal(messages.length, 0);
  }],
  ['checkForUpdate: 探针抛错被吞掉且不影响调用方', async () => {
    const messages: string[] = [];
    await assert.doesNotReject(
      checkForUpdate({
        env: {},
        fromUrl: import.meta.url,
        fetchRc: () => {
          throw new Error('network down');
        },
        notify: (message) => {
          messages.push(message);
        },
      }),
    );
    assert.equal(messages.length, 0);
  }],
  ['fetchRcVersion: 连接失败返回 null（不抛错）', async () => {
    const result = await fetchRcVersion('https://127.0.0.1:1', '@xihe-lab/tapd-core', 500);
    assert.equal(result, null);
  }],
];

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length}/${checks.length} passed`);
}
