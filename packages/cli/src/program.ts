import { createRequire } from 'node:module';
import { Command } from 'commander';
import {
  type DerivedCommand,
  type ExecContext,
  type TapdConfig,
  type ToolDef,
  type ToolRegistry,
  resolveConfig,
} from '@xihe-lab/tapd-core';
import { addGlobalOptions, bindSchemaFlags, makeClientFactory, parseOutputMode, toArgs } from './flags.js';
import { format } from './output/formatter.js';
import { CliError } from './errors.js';
import { registerConfigCommand } from './commands/config.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerAdvisorCommand } from './commands/advisor.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const RESOURCE_ALIASES: Record<string, string> = {
  story: 's',
  bug: 'b',
  task: 't',
  iteration: 'i',
  wiki: 'w',
};

export function buildProgram(registry: ToolRegistry, config: TapdConfig = {}): Command {
  const program: Command = new Command();
  program
    .name('tapd')
    .version(version)
    .description('TAPD 研发协作命令行（与 tapd-mcp-server 共享内核）')
    .exitOverride();
  addGlobalOptions(program);

  const resourceCmds = new Map<string, Command>();
  const ensureResource = (resource: string): Command => {
    let parent = resourceCmds.get(resource);
    if (!parent) {
      parent = program.command(resource).description(`${resource} 相关命令`);
      const alias = RESOURCE_ALIASES[resource];
      if (alias) parent.alias(alias);
      resourceCmds.set(resource, parent);
    }
    return parent;
  };

  for (const cmd of registry.commands()) {
    const tool = registry.get(cmd.tool);
    if (!tool) continue;
    const parent = ensureResource(cmd.resource);
    const sub = parent.command(cmd.action, cmd.hidden ? { hidden: true } : undefined).description(tool.description);
    if (tool.cli?.examples?.length) {
      const lines = ['Examples:', ...tool.cli.examples.map(ex => `  $ ${ex}`)];
      sub.addHelpText('after', lines.join('\n'));
    }
    addGlobalOptions(sub);
    bindSchemaFlags(sub, tool, tool.cli);
    sub.action((...argv: unknown[]) => runCommand(registry, cmd, tool, argv, program, config));
  }

  registerConfigCommand(program);
  registerAuthCommand(ensureResource);
  registerAdvisorCommand(program, registry);
  return program;
}

async function runCommand(
  registry: ToolRegistry,
  cmd: DerivedCommand,
  tool: ToolDef,
  argv: unknown[],
  program: Command,
  config: TapdConfig,
): Promise<void> {
  const command = argv[argv.length - 1] as Command;
  const positional = argv.slice(0, -1);
  const globals = { ...program.opts(), ...command.opts() };
  if (globals.verbose) process.env.TAPD_LOG_VERBOSE = '1';
  const outputMode = parseOutputMode(globals.output);

  const args = toArgs(tool, tool.cli, command.opts(), positional, globals);
  const resolved = resolveConfig(globals, config);
  const ctx: ExecContext = {
    entry: 'cli',
    readOnly: resolved.readOnly,
    timeoutMs: resolved.timeoutMs,
  };
  const result = await registry.exec(cmd.tool, args, ctx, makeClientFactory(globals));
  if (!result.ok) throw new CliError(result.error!.code, result.error!.message);
  const output = format(result, cmd, {
    output: outputMode,
    isTTY: Boolean(process.stdout.isTTY),
    configuredFormat: resolved.default_output && resolved.default_output !== 'auto' ? resolved.default_output : undefined,
    verbose: Boolean(globals.verbose),
    meta: tool.cli,
  });
  process.stdout.write(output + '\n');
}
