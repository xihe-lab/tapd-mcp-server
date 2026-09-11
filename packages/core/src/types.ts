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
  /**
   * 显式副作用标注（FSD §3.4）：不计入实体写闸门（resolveWrite 不受影响），
   * 仅供审计与 CLI 提示（如 tapd_md_to_html --upload-images 的图片上传）。
   */
  side_effect?: 'upload';
}

/**
 * Re-export TAPD types for convenience
 */
export type { TapdClient } from './tapd-client.js';
export type { TapdResponse } from './tapd-client.js';
