import { z } from 'zod';
import type { Command } from 'commander';
import { TapdClient, type CliMeta, type ToolDef } from '@xihe-lab/tapd-core';
import type { OutputMode } from './output/formatter.js';
import { CliError } from './errors.js';

const GLOBAL_KEYS = new Set([
  'workspaceId', 'apiKey', 'auth', 'readOnly', 'output', 'timeout', 'color', 'verbose',
]);

const kebab = (key: string): string => key.replaceAll('_', '-');
const camelToSnake = (key: string): string => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

function parseWorkspaceId(value: string): number {
  const id = parseInt(value, 10);
  if (Number.isNaN(id)) throw new Error(`--workspace-id must be a number, got "${value}"`);
  return id;
}

function parseTimeout(value: string): number {
  const seconds = parseFloat(value);
  if (Number.isNaN(seconds) || seconds < 0) throw new Error(`--timeout must be a non-negative number of seconds, got "${value}"`);
  return Math.round(seconds * 1000);
}

export function parseOutputMode(value: unknown): OutputMode | undefined {
  if (value === undefined) return undefined;
  if (value === 'text' || value === 'table' || value === 'json') return value;
  const got = typeof value === 'string' ? value : JSON.stringify(value);
  throw new CliError('INVALID_ARGS', `--output must be one of text | table | json, got "${got}"`);
}

export function addGlobalOptions(cmd: Command): void {
  cmd
    .option('--workspace-id <id>', '默认项目 ID（优先级高于环境变量）', parseWorkspaceId)
    .option('--api-key <token>', 'TAPD API Token（Access Token，覆盖环境变量）')
    .option('--auth <mode>', '认证方式 token | basic')
    .option('--read-only', '只读模式，拦截所有写命令')
    .option('--no-read-only', '显式关闭只读模式（优先于配置文件）')
    .option('--output <fmt>', '输出格式 text | table | json（缺省自动：管道 json，终端 table/text）')
    .option('--timeout <seconds>', '单命令超时秒数', parseTimeout)
    .option('--no-color', '关闭彩色输出')
    .option('-v, --verbose', '打印请求/响应日志（凭证脱敏）');
}

function unwrap(field: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = field;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) {
      cur = (cur as z.ZodOptional<z.ZodTypeAny>)._def.innerType;
    } else if (cur instanceof z.ZodDefault) {
      cur = cur._def.innerType;
    } else {
      return cur;
    }
  }
}

function shapeOf(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  return schema instanceof z.ZodObject ? (schema.shape as Record<string, z.ZodTypeAny>) : {};
}

function describe(field: z.ZodTypeAny): string | undefined {
  return field.description ?? unwrap(field).description;
}

function isNumberish(field: z.ZodTypeAny): boolean {
  const inner = unwrap(field);
  if (inner instanceof z.ZodNumber) return true;
  if (!(inner instanceof z.ZodUnion)) return false;
  const options = inner.options as readonly z.ZodTypeAny[];
  return options.some(o => o instanceof z.ZodNumber);
}

function coerceValue(value: unknown, numberish: boolean): unknown {
  if (numberish && typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return value;
}

export function bindSchemaFlags(sub: Command, tool: ToolDef, meta?: CliMeta): void {
  const shape = shapeOf(tool.inputSchema);
  for (const [key, field] of Object.entries(shape)) {
    if (key === 'workspace_id') continue;
    const flag = `--${kebab(key)}`;
    const inner = unwrap(field);
    const desc = describe(field);
    if (inner instanceof z.ZodBoolean) {
      sub.option(`${flag} / --no-${kebab(key)}`, desc, undefined);
    } else if (inner instanceof z.ZodArray) {
      sub.option(`${flag} <items...>`, desc);
    } else {
      sub.option(`${flag} <value>`, desc);
    }
  }
  if (meta?.positional) sub.argument(`<${meta.positional}>`);
}

export function toArgs(
  tool: ToolDef,
  meta: CliMeta | undefined,
  opts: Record<string, unknown>,
  positional: unknown[],
  globals: Record<string, unknown>,
): Record<string, unknown> {
  const shape = shapeOf(tool.inputSchema);
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined || GLOBAL_KEYS.has(key)) continue;
    const snake = camelToSnake(key);
    args[snake] = coerceValue(value, isNumberish(shape[snake]));
  }
  if (args.workspace_id === undefined && globals.workspaceId !== undefined) {
    args.workspace_id = globals.workspaceId;
  }
  if (meta?.positional && positional.length > 0) {
    args[meta.positional] = positional[0];
  }
  return { ...(meta?.defaults ?? {}), ...args };
}

export function makeClientFactory(globals: Record<string, unknown>): () => TapdClient {
  return () => {
    if (globals.auth === 'basic') {
      const user = process.env.TAPD_API_USER;
      const password = process.env.TAPD_API_PASSWORD;
      if (!user || !password) {
        throw new Error('auth mode "basic" requires TAPD_API_USER and TAPD_API_PASSWORD environment variables');
      }
      return TapdClient.fromBasicAuth(user, password);
    }
    const apiKey = globals.apiKey as string | undefined;
    if (apiKey) return TapdClient.fromAccessToken(apiKey);
    return TapdClient.fromEnv();
  };
}
