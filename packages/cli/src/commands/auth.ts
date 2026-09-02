import type { Command } from 'commander';
import { loadConfig, maskSecret, resolveConfig, type ConfigSource, type ResolvedConfig } from '@xihe-lab/tapd-core';

function sourceTag(source: ConfigSource | undefined): string {
  return source ?? 'default';
}

function credentialSummary(resolved: ResolvedConfig): string {
  const parts: string[] = [];
  if (resolved.access_token) {
    parts.push(`access_token ${maskSecret(resolved.access_token)} (${sourceTag(resolved.sources.access_token)})`);
  }
  if (resolved.api_user) {
    parts.push(`api_user ${maskSecret(resolved.api_user)} (${sourceTag(resolved.sources.api_user)})`);
  }
  return parts.length > 0 ? parts.join('; ') : '(missing)';
}

export function registerAuthCommand(ensureResource: (resource: string) => Command): void {
  const auth = ensureResource('auth');
  auth.command('status').description('查看认证状态').action(() => {
    const resolved = resolveConfig({}, loadConfig());
    const lines = [
      `auth_mode: ${resolved.auth_mode} (${sourceTag(resolved.sources.auth_mode)})`,
      `credentials: ${credentialSummary(resolved)}`,
      `workspace_id: ${resolved.workspace_id ?? '(unset)'} (${sourceTag(resolved.sources.workspace_id)})`,
      `read_only: ${resolved.readOnly} (${sourceTag(resolved.sources.read_only)})`,
    ];
    process.stdout.write(lines.join('\n') + '\n');
  });
}
