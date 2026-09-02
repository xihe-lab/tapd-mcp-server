import type { z } from 'zod';
import type { ToolDef } from '../types.js';
import type { TapdClient } from '../tapd-client.js';
import { resolveWrite } from './write-policy.js';

export type Entry = 'cli' | 'mcp';

export interface ExecContext {
  entry: Entry;
  readOnly?: boolean;
  timeoutMs?: number;
  onAudit?: (event: AuditEvent) => void;
}

export interface AuditEvent {
  ts: string;
  entry: Entry;
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  errorCode?: CliErrorCode;
  durationMs: number;
}

export type CliErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'INVALID_ARGS'
  | 'READ_ONLY_BLOCKED'
  | 'AUTH_MISSING'
  | 'API_ERROR'
  | 'TIMEOUT';

export interface ExecResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: CliErrorCode; message: string };
}

export interface DerivedCommand {
  tool: string;
  resource: string;
  action: string;
  write: boolean;
  hidden: boolean;
}

const DEFAULT_TIMEOUT_MS = 60_000;

const SENSITIVE_KEY = /password|token|secret|credential/i;

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = SENSITIVE_KEY.test(key) ? '***' : value;
  }
  return out;
}

function formatInvalidArgs(error: z.ZodError): string {
  return error.issues
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

class TimeoutSignal extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutSignal(`tool timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  promise.catch(() => undefined);
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  register(tools: ToolDef[]): void {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        throw new Error(`Duplicate tool name: ${tool.name}`);
      }
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  list(): ToolDef[] {
    return [...this.tools.values()];
  }

  commands(): DerivedCommand[] {
    return this.list().map(tool => {
      const parts = tool.name.replace(/^tapd_/, '').split('_');
      return {
        tool: tool.name,
        resource: parts.slice(1).join('-') || parts[0],
        action: parts[0],
        write: resolveWrite(tool),
        hidden: false,
      };
    });
  }

  async exec<T = unknown>(
    name: string,
    args: unknown,
    ctx: ExecContext,
    clientFactory?: () => TapdClient,
  ): Promise<ExecResult<T>> {
    const start = Date.now();
    const finish = (ok: boolean, errorCode?: CliErrorCode): void => {
      if (!ctx.onAudit) return;
      ctx.onAudit({
        ts: new Date().toISOString(),
        entry: ctx.entry,
        tool: name,
        args: sanitizeArgs((args ?? {}) as Record<string, unknown>),
        ok,
        ...(errorCode ? { errorCode } : {}),
        durationMs: Date.now() - start,
      });
    };

    const tool = this.tools.get(name);
    if (!tool) {
      finish(false, 'TOOL_NOT_FOUND');
      return { ok: false, error: { code: 'TOOL_NOT_FOUND', message: `Tool not found: ${name}` } };
    }

    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      finish(false, 'INVALID_ARGS');
      return { ok: false, error: { code: 'INVALID_ARGS', message: formatInvalidArgs(parsed.error) } };
    }

    if (resolveWrite(tool) && ctx.readOnly) {
      finish(false, 'READ_ONLY_BLOCKED');
      return { ok: false, error: { code: 'READ_ONLY_BLOCKED', message: `Tool ${name} is a write operation, blocked in read-only mode` } };
    }

    let client: TapdClient;
    try {
      if (!clientFactory) throw new Error('no client factory provided');
      client = clientFactory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      finish(false, 'AUTH_MISSING');
      return { ok: false, error: { code: 'AUTH_MISSING', message } };
    }

    try {
      const data = await withTimeout(
        tool.handler(client, parsed.data),
        ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      finish(true);
      return { ok: true, data: data as T };
    } catch (error) {
      if (error instanceof TimeoutSignal) {
        finish(false, 'TIMEOUT');
        return { ok: false, error: { code: 'TIMEOUT', message: error.message } };
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      finish(false, 'API_ERROR');
      return { ok: false, error: { code: 'API_ERROR', message } };
    }
  }
}
