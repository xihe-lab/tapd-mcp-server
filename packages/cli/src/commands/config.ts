import { writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import {
  allTools,
  CONFIG_KEYS,
  configPath,
  exportSchemas,
  loadConfig,
  maskSecret,
  parseConfigSet,
  resolveConfig,
  saveConfig,
  type ConfigSource,
  type ResolvedConfig,
  type SchemaExportFormat,
} from '@xihe-lab/tapd-core';
import { CliError } from '../errors.js';

const SECRET_KEYS: ReadonlySet<string> = new Set(['access_token', 'api_password']);

function sourceTag(source: ConfigSource | undefined): string {
  return source ?? 'default';
}

function renderValue(value: unknown): string {
  if (value === undefined) return '(unset)';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function renderConfig(resolved: ResolvedConfig): string {
  const record = resolved as unknown as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of CONFIG_KEYS) {
    if (SECRET_KEYS.has(key)) {
      lines.push(`${key}: ${maskSecret(record[key] as string | undefined)} (${sourceTag(resolved.sources[key])})`);
      continue;
    }
    lines.push(`${key}: ${renderValue(record[key])} (${sourceTag(resolved.sources[key])})`);
  }
  lines.push(`use_sdk (effective): ${resolved.useSdk}`);
  lines.push(`use_richtext_auto (effective): ${resolved.useRichtextAuto}`);
  lines.push(`timeout (effective): ${resolved.timeoutMs}ms`);
  return lines.join('\n');
}

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('TAPD 本地配置管理');

  config.command('show').description('查看当前生效配置（凭证脱敏）').action(() => {
    const resolved = resolveConfig({}, loadConfig());
    process.stdout.write(renderConfig(resolved) + '\n');
  });

  config.command('set').description('设置配置项').argument('<items...>', 'key=value 列表').action((items: string[]) => {
    let patch;
    try {
      patch = parseConfigSet(items);
    } catch (error) {
      throw new CliError('INVALID_ARGS', error instanceof Error ? error.message : String(error));
    }
    const merged = { ...loadConfig(), ...patch };
    saveConfig(merged);
    process.stdout.write(`saved ${Object.keys(patch).length} key(s) to ${configPath()}\n`);
  });

  config.command('export-schema')
    .description('导出工具 schema（anthropic / openai 格式）')
    .option('--format <format>', '导出格式：anthropic | openai', 'anthropic')
    .option('--resource <resource>', '按资源过滤（如 story）')
    .option('--out <file>', '写入文件而非 stdout')
    .action((options: { format: string; resource?: string; out?: string }) => {
      if (options.format !== 'anthropic' && options.format !== 'openai') {
        throw new CliError('INVALID_ARGS', `format: invalid_enum_value（预期 anthropic | openai，收到 ${options.format}）`);
      }
      const format: SchemaExportFormat = options.format;
      const exported = exportSchemas(allTools, format, { resource: options.resource }) as unknown[];
      const json = JSON.stringify(exported, null, 2);
      if (options.out) {
        writeFileSync(options.out, json + '\n');
        process.stdout.write(`exported ${exported.length} tools to ${options.out}\n`);
      } else {
        process.stdout.write(json + '\n');
      }
    });
}
