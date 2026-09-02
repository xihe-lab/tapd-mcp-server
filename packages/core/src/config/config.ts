import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type AuthMode = 'token' | 'basic';
export type OutputFormat = 'text' | 'table' | 'json' | 'auto';

export interface TapdConfig {
  workspace_id?: number;
  auth_mode?: AuthMode;
  access_token?: string;
  api_user?: string;
  api_password?: string;
  nick_name?: string;
  default_output?: OutputFormat;
  timeout?: number;
  read_only?: boolean;
  use_sdk?: boolean;
  use_richtext_auto?: boolean;
  default_story_workitem_type_id?: string;
  default_task_workitem_type_id?: string;
}

export const CONFIG_KEYS = [
  'workspace_id',
  'auth_mode',
  'access_token',
  'api_user',
  'api_password',
  'nick_name',
  'default_output',
  'timeout',
  'read_only',
  'use_sdk',
  'use_richtext_auto',
  'default_story_workitem_type_id',
  'default_task_workitem_type_id',
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export type ConfigSource = 'flag' | 'env' | 'config' | 'default';

export interface ConfigFlags {
  workspaceId?: number;
  apiKey?: string;
  auth?: AuthMode;
  readOnly?: boolean;
  output?: OutputFormat;
  timeout?: number;
}

export interface ResolvedConfig extends TapdConfig {
  readOnly: boolean;
  useSdk: boolean;
  useRichtextAuto: boolean;
  timeoutMs: number;
  sources: Partial<Record<ConfigKey | 'read_only' | 'timeout', ConfigSource>>;
}

const DEFAULT_TIMEOUT_SECONDS = 60;

export function configPath(): string {
  return process.env.TAPD_CONFIG_PATH ?? path.join(os.homedir(), '.tapd', 'config.json');
}

export function loadConfig(filePath?: string): TapdConfig {
  const file = filePath ?? configPath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    console.error(`[tapd] config file is not a JSON object, ignored: ${file}`);
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[tapd] failed to parse config file, ignored: ${file} (${message})`);
    return {};
  }
}

export function saveConfig(config: TapdConfig, filePath?: string): void {
  const file = filePath ?? configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

const injectedEnv = new Map<string, string>();

function setIfUnset(key: string, value: string): void {
  if (process.env[key]) return;
  process.env[key] = value;
  injectedEnv.set(key, value);
}

function envRaw(key: string): string | undefined {
  const injected = injectedEnv.get(key);
  if (injected !== undefined && process.env[key] === injected) return undefined;
  const raw = process.env[key];
  return raw === undefined || raw === '' ? undefined : raw;
}

export function applyConfigToEnv(config: TapdConfig): void {
  if (config.workspace_id !== undefined) setIfUnset('TAPD_DEFAULT_WORKSPACE_ID', String(config.workspace_id));
  if (config.nick_name !== undefined) setIfUnset('TAPD_NICK_NAME', config.nick_name);
  if (config.default_story_workitem_type_id !== undefined) setIfUnset('TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID', config.default_story_workitem_type_id);
  if (config.default_task_workitem_type_id !== undefined) setIfUnset('TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID', config.default_task_workitem_type_id);
  if (config.access_token !== undefined) setIfUnset('TAPD_ACCESS_TOKEN', config.access_token);
  if (config.api_user !== undefined) setIfUnset('TAPD_API_USER', config.api_user);
  if (config.api_password !== undefined) setIfUnset('TAPD_API_PASSWORD', config.api_password);
  if (config.use_sdk === false) setIfUnset('TAPD_SDK_DISABLED', '1');
  if (config.use_richtext_auto === false) setIfUnset('TAPD_RICHTEXT_AUTO', '0');
}

function resolveField<T>(
  sources: ResolvedConfig['sources'],
  key: keyof NonNullable<ResolvedConfig['sources']>,
  flagValue: T | undefined,
  envValue: T | undefined,
  configValue: T | undefined,
  fallback: T,
): T {
  if (flagValue !== undefined) {
    sources[key] = 'flag';
    return flagValue;
  }
  if (envValue !== undefined) {
    sources[key] = 'env';
    return envValue;
  }
  if (configValue !== undefined) {
    sources[key] = 'config';
    return configValue;
  }
  sources[key] = 'default';
  return fallback;
}

function parseEnvNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export function resolveConfig(flags: ConfigFlags = {}, config: TapdConfig = {}): ResolvedConfig {
  const sources: ResolvedConfig['sources'] = {};

  const workspace_id = resolveField(
    sources, 'workspace_id',
    flags.workspaceId,
    parseEnvNumber(envRaw('TAPD_DEFAULT_WORKSPACE_ID')),
    config.workspace_id,
    undefined,
  );
  const access_token = resolveField(
    sources, 'access_token',
    flags.apiKey,
    envRaw('TAPD_ACCESS_TOKEN'),
    config.access_token,
    undefined,
  );
  const api_user = resolveField(sources, 'api_user', undefined, envRaw('TAPD_API_USER'), config.api_user, undefined);
  const api_password = resolveField(sources, 'api_password', undefined, envRaw('TAPD_API_PASSWORD'), config.api_password, undefined);
  const auth_mode = resolveField(sources, 'auth_mode', flags.auth, undefined, config.auth_mode, 'token');
  const nick_name = resolveField(sources, 'nick_name', undefined, envRaw('TAPD_NICK_NAME'), config.nick_name, undefined);
  const default_story_workitem_type_id = resolveField(
    sources, 'default_story_workitem_type_id',
    undefined,
    envRaw('TAPD_DEFAULT_STORY_WORKITEM_TYPE_ID'),
    config.default_story_workitem_type_id,
    undefined,
  );
  const default_task_workitem_type_id = resolveField(
    sources, 'default_task_workitem_type_id',
    undefined,
    envRaw('TAPD_DEFAULT_TASK_WORKITEM_TYPE_ID'),
    config.default_task_workitem_type_id,
    undefined,
  );
  const default_output = resolveField(sources, 'default_output', flags.output, undefined, config.default_output, 'auto');

  let read_only: boolean;
  if (flags.readOnly !== undefined) {
    sources.read_only = 'flag';
    read_only = flags.readOnly;
  } else {
    sources.read_only = config.read_only !== undefined ? 'config' : 'default';
    read_only = config.read_only ?? false;
  }

  let timeoutMs: number;
  if (flags.timeout !== undefined) {
    sources.timeout = 'flag';
    timeoutMs = flags.timeout;
  } else if (config.timeout !== undefined) {
    sources.timeout = 'config';
    timeoutMs = config.timeout * 1000;
  } else {
    sources.timeout = 'default';
    timeoutMs = DEFAULT_TIMEOUT_SECONDS * 1000;
  }

  const useSdk = config.use_sdk === false
    ? false
    : envRaw('TAPD_SDK_DISABLED') !== '1';

  const useRichtextAuto = config.use_richtext_auto === false
    ? false
    : envRaw('TAPD_RICHTEXT_AUTO') !== '0';

  return {
    workspace_id,
    auth_mode,
    access_token,
    api_user,
    api_password,
    nick_name,
    default_output,
    read_only,
    use_sdk: config.use_sdk,
    use_richtext_auto: config.use_richtext_auto,
    timeout: timeoutMs / 1000,
    default_story_workitem_type_id,
    default_task_workitem_type_id,
    readOnly: read_only,
    useSdk,
    useRichtextAuto,
    timeoutMs,
    sources,
  };
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '(unset)';
  if (value.length <= 4) return '***';
  return `***${value.slice(-4)}`;
}

const NUMBER_KEYS: ReadonlySet<string> = new Set(['workspace_id', 'timeout']);
const BOOL_KEYS: ReadonlySet<string> = new Set(['read_only', 'use_sdk', 'use_richtext_auto']);

export function parseConfigSet(items: string[]): Partial<TapdConfig> {
  const out: Partial<TapdConfig> = {};
  for (const item of items) {
    const eq = item.indexOf('=');
    if (eq <= 0) {
      throw new Error(`invalid config item "${item}", expected key=value`);
    }
    const key = item.slice(0, eq);
    const value = item.slice(eq + 1);
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) {
      throw new Error(`unknown config key "${key}", allowed keys: ${CONFIG_KEYS.join(', ')}`);
    }
    const record = out as Record<string, unknown>;
    if (NUMBER_KEYS.has(key)) {
      const num = Number(value);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error(`config key "${key}" expects a positive integer, got "${value}"`);
      }
      record[key] = num;
    } else if (BOOL_KEYS.has(key)) {
      if (value !== 'true' && value !== 'false') {
        throw new Error(`config key "${key}" expects true or false, got "${value}"`);
      }
      record[key] = value === 'true';
    } else if (key === 'auth_mode') {
      if (value !== 'token' && value !== 'basic') {
        throw new Error(`config key "auth_mode" expects "token" or "basic", got "${value}"`);
      }
      record[key] = value;
    } else if (key === 'default_output') {
      if (!['text', 'table', 'json', 'auto'].includes(value)) {
        throw new Error(`config key "default_output" expects text | table | json | auto, got "${value}"`);
      }
      record[key] = value;
    } else {
      record[key] = value;
    }
  }
  return out;
}
