import type { z } from 'zod';
import type { TapdClient } from './tapd-client.js';

/**
 * Tool definition interface for MCP tools
 */
export interface ToolDef<TInputSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  handler: (client: TapdClient, params: z.infer<TInputSchema>) => Promise<unknown>;
}

/**
 * Re-export TAPD types for convenience
 */
export type { TapdClient } from './tapd-client.js';
export type { TapdResponse } from './tapd-client.js';
