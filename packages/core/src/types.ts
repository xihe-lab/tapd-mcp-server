import type { z } from 'zod';
import type { TapdClient } from './tapd-client.js';

/**
 * CLI command metadata for a tool (requirement 1280).
 * Optional on ToolDef; tools without it fall back to name-based derivation.
 */
export interface CliMeta {
  resource: string;
  action: string;
  alias?: string;
  examples?: string[];
  outputFormat?: 'text' | 'table' | 'json';
  columns?: string[];
  positional?: string;
  defaults?: Record<string, unknown>;
  hidden?: boolean;
}

/**
 * Tool definition interface for MCP tools
 */
export interface ToolDef<TInputSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  handler: (client: TapdClient, params: z.infer<TInputSchema>) => Promise<unknown>;
  cli?: CliMeta;
  write?: boolean;
}

/**
 * Re-export TAPD types for convenience
 */
export type { TapdClient } from './tapd-client.js';
export type { TapdResponse } from './tapd-client.js';
