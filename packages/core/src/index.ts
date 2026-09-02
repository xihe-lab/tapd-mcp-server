export type { ToolDef, TapdResponse, CliMeta } from './types.js';
export { TapdClient } from './tapd-client.js';
export { allTools } from './tools/index.js';
export {
  ToolRegistry,
  type Entry,
  type ExecContext,
  type AuditEvent,
  type CliErrorCode,
  type ExecResult,
  type DerivedCommand,
} from './registry/registry.js';
export { resolveWrite } from './registry/write-policy.js';
export { deriveCommand, type DerivedCommandParts } from './registry/derive-command.js';
export { MANUAL_CLI_META, EXPLICIT_WRITE } from './registry/cli-meta.js';
