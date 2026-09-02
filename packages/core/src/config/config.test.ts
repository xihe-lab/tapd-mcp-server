import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyConfigToEnv, loadConfig, maskSecret, parseConfigSet, resolveConfig, saveConfig } from './config.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapd-config-test-'));
const configFile = path.join(tmpDir, 'config.json');
process.env.TAPD_CONFIG_PATH = configFile;

const ENV_KEYS = [
  'TAPD_ACCESS_TOKEN',
  'TAPD_API_USER',
  'TAPD_API_PASSWORD',
  'TAPD_DEFAULT_WORKSPACE_ID',
  'TAPD_NICK_NAME',
  'TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID',
  'TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID',
  'TAPD_SDK_DISABLED',
] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

const checks: [string, () => void][] = [
  ['loadConfig: missing file -> empty config', () => {
    clearEnv();
    assert.deepEqual(loadConfig(configFile), {});
  }],

  ['loadConfig: invalid JSON -> empty config', () => {
    fs.writeFileSync(configFile, '{not json', 'utf8');
    assert.deepEqual(loadConfig(configFile), {});
  }],

  ['loadConfig: non-object JSON -> empty config', () => {
    fs.writeFileSync(configFile, '[1,2,3]', 'utf8');
    assert.deepEqual(loadConfig(configFile), {});
  }],

  ['saveConfig: writes file with 0600 permission and loadConfig reads it back', () => {
    fs.rmSync(configFile, { force: true });
    saveConfig({ workspace_id: 39814312, access_token: 'secret-token-abcd', read_only: true });
    const mode = fs.statSync(configFile).mode & 0o777;
    assert.equal(mode, 0o600);
    assert.deepEqual(loadConfig(configFile), {
      workspace_id: 39814312,
      access_token: 'secret-token-abcd',
      read_only: true,
    });
  }],

  ['applyConfigToEnv: injects missing env keys from config', () => {
    clearEnv();
    applyConfigToEnv({
      workspace_id: 100,
      nick_name: 'tester',
      access_token: 'cfg-token',
      api_user: 'cfg-user',
      api_password: 'cfg-pass',
      default_story_workitem_type_id: 's-type',
      default_task_workitem_type_id: 't-type',
    });
    assert.equal(process.env.TAPD_DEFAULT_WORKSPACE_ID, '100');
    assert.equal(process.env.TAPD_NICK_NAME, 'tester');
    assert.equal(process.env.TAPD_ACCESS_TOKEN, 'cfg-token');
    assert.equal(process.env.TAPD_API_USER, 'cfg-user');
    assert.equal(process.env.TAPD_API_PASSWORD, 'cfg-pass');
    assert.equal(process.env.TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID, 's-type');
    assert.equal(process.env.TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID, 't-type');
    assert.equal(process.env.TAPD_SDK_DISABLED, undefined);
  }],

  ['applyConfigToEnv: never overwrites explicitly provided env', () => {
    clearEnv();
    process.env.TAPD_ACCESS_TOKEN = 'env-token';
    process.env.TAPD_DEFAULT_WORKSPACE_ID = '999';
    applyConfigToEnv({ workspace_id: 100, access_token: 'cfg-token' });
    assert.equal(process.env.TAPD_ACCESS_TOKEN, 'env-token');
    assert.equal(process.env.TAPD_DEFAULT_WORKSPACE_ID, '999');
    assert.equal(process.env.TAPD_API_USER, undefined);
  }],

  ['applyConfigToEnv: empty-string env is treated as unset', () => {
    clearEnv();
    process.env.TAPD_ACCESS_TOKEN = '';
    process.env.TAPD_DEFAULT_WORKSPACE_ID = '';
    applyConfigToEnv({ workspace_id: 100, access_token: 'cfg-token' });
    assert.equal(process.env.TAPD_ACCESS_TOKEN, 'cfg-token');
    assert.equal(process.env.TAPD_DEFAULT_WORKSPACE_ID, '100');
  }],

  ['applyConfigToEnv: use_sdk false maps to TAPD_SDK_DISABLED=1 when env unset', () => {
    clearEnv();
    applyConfigToEnv({ use_sdk: false });
    assert.equal(process.env.TAPD_SDK_DISABLED, '1');

    clearEnv();
    process.env.TAPD_SDK_DISABLED = '0';
    applyConfigToEnv({ use_sdk: false });
    assert.equal(process.env.TAPD_SDK_DISABLED, '0');
  }],

  ['priority matrix: flag overrides env (access_token)', () => {
    clearEnv();
    process.env.TAPD_ACCESS_TOKEN = 'env-token';
    const resolved = resolveConfig({ apiKey: 'flag-token' }, { access_token: 'cfg-token' });
    assert.equal(resolved.access_token, 'flag-token');
    assert.equal(resolved.sources.access_token, 'flag');
  }],

  ['priority matrix: env overrides config (workspace_id + access_token)', () => {
    clearEnv();
    process.env.TAPD_DEFAULT_WORKSPACE_ID = '222';
    process.env.TAPD_ACCESS_TOKEN = 'env-token';
    const resolved = resolveConfig({}, { workspace_id: 111, access_token: 'cfg-token' });
    assert.equal(resolved.workspace_id, 222);
    assert.equal(resolved.sources.workspace_id, 'env');
    assert.equal(resolved.access_token, 'env-token');
    assert.equal(resolved.sources.access_token, 'env');
  }],

  ['priority matrix: config overrides built-in default (timeout, nick_name)', () => {
    clearEnv();
    const resolved = resolveConfig({}, { timeout: 30, nick_name: 'cfg-nick' });
    assert.equal(resolved.timeoutMs, 30_000);
    assert.equal(resolved.sources.timeout, 'config');
    assert.equal(resolved.nick_name, 'cfg-nick');
    assert.equal(resolved.sources.nick_name, 'config');
    assert.equal(resolved.readOnly, false);
    assert.equal(resolved.sources.read_only, 'default');
    assert.equal(resolved.default_output, 'auto');
  }],

  ['resolveConfig: no config and no env falls back to defaults', () => {
    clearEnv();
    const resolved = resolveConfig({}, {});
    assert.equal(resolved.workspace_id, undefined);
    assert.equal(resolved.access_token, undefined);
    assert.equal(resolved.auth_mode, 'token');
    assert.equal(resolved.timeoutMs, 60_000);
    assert.equal(resolved.useSdk, true);
    assert.equal(resolved.readOnly, false);
  }],

  ['resolveConfig: flag timeout (ms) overrides config timeout (seconds)', () => {
    clearEnv();
    const resolved = resolveConfig({ timeout: 5_000 }, { timeout: 30 });
    assert.equal(resolved.timeoutMs, 5_000);
    assert.equal(resolved.sources.timeout, 'flag');
  }],

  ['read_only: config true without flag blocks (resolved.readOnly true)', () => {
    clearEnv();
    const resolved = resolveConfig({}, { read_only: true });
    assert.equal(resolved.readOnly, true);
    assert.equal(resolved.sources.read_only, 'config');
  }],

  ['read_only: --no-read-only flag overrides config read_only=true (flag wins)', () => {
    clearEnv();
    const resolved = resolveConfig({ readOnly: false }, { read_only: true });
    assert.equal(resolved.readOnly, false);
    assert.equal(resolved.sources.read_only, 'flag');
  }],

  ['read_only: --read-only flag works without config', () => {
    clearEnv();
    const resolved = resolveConfig({ readOnly: true }, {});
    assert.equal(resolved.readOnly, true);
    assert.equal(resolved.sources.read_only, 'flag');
  }],

  ['resolveConfig: config-injected env is attributed back to config source', () => {
    clearEnv();
    applyConfigToEnv({ access_token: 'cfg-token', workspace_id: 555 });
    const resolved = resolveConfig({}, { access_token: 'cfg-token', workspace_id: 555 });
    assert.equal(resolved.access_token, 'cfg-token');
    assert.equal(resolved.sources.access_token, 'config');
    assert.equal(resolved.sources.workspace_id, 'config');
  }],

  ['resolveConfig: env changed after injection is treated as env source', () => {
    clearEnv();
    applyConfigToEnv({ access_token: 'cfg-token' });
    process.env.TAPD_ACCESS_TOKEN = 'later-env-token';
    const resolved = resolveConfig({}, { access_token: 'cfg-token' });
    assert.equal(resolved.access_token, 'later-env-token');
    assert.equal(resolved.sources.access_token, 'env');
  }],

  ['maskSecret: shows only last 4 chars', () => {
    assert.equal(maskSecret('abcd12345678'), '***5678');
    assert.equal(maskSecret('abc'), '***');
    assert.equal(maskSecret(''), '(unset)');
    assert.equal(maskSecret(undefined), '(unset)');
  }],

  ['parseConfigSet: converts types by key', () => {
    const parsed = parseConfigSet([
      'workspace_id=39814312',
      'timeout=120',
      'read_only=true',
      'use_sdk=false',
      'auth_mode=basic',
      'default_output=json',
      'access_token=tok',
      'nick_name=张三',
    ]);
    assert.deepEqual(parsed, {
      workspace_id: 39814312,
      timeout: 120,
      read_only: true,
      use_sdk: false,
      auth_mode: 'basic',
      default_output: 'json',
      access_token: 'tok',
      nick_name: '张三',
    });
  }],

  ['parseConfigSet: rejects unknown keys and bad values', () => {
    assert.throws(() => parseConfigSet(['nope=1']), /unknown config key "nope"/);
    assert.throws(() => parseConfigSet(['workspace_id']), /expected key=value/);
    assert.throws(() => parseConfigSet(['workspace_id=abc']), /positive integer/);
    assert.throws(() => parseConfigSet(['read_only=yes']), /expects true or false/);
    assert.throws(() => parseConfigSet(['auth_mode=oauth']), /expects "token" or "basic"/);
    assert.throws(() => parseConfigSet(['default_output=csv']), /text \| table \| json \| auto/);
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

clearEnv();
fs.rmSync(tmpDir, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length}/${checks.length} passed`);
}
