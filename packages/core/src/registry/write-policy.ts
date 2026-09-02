import type { ToolDef } from '../types.js';

const WRITE_VERBS =
  /^(create|update|delete|add|copy|batch_update|save|remove|execute|lock|unlock|assign|bind|relate|link|submit|upload|set)_/;

export function resolveWrite(tool: ToolDef): boolean {
  return tool.write ?? WRITE_VERBS.test(tool.name.replace(/^tapd_/, ''));
}
