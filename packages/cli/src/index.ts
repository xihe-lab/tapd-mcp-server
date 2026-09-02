import { CommanderError } from 'commander';
import { allTools, ToolRegistry } from '@xihe-lab/tapd-core';
import { buildProgram } from './program.js';
import { CliError } from './errors.js';
import { EXIT } from './exit-codes.js';

export { buildProgram } from './program.js';
export { CliError } from './errors.js';
export { EXIT } from './exit-codes.js';

export async function main(argv: string[] = process.argv): Promise<void> {
  const start = process.hrtime.bigint();
  const registry = new ToolRegistry();
  registry.register(allTools);
  const program = buildProgram(registry);
  if (process.env.TAPD_CLI_TIMING === '1') {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    process.stderr.write(`[timing] command tree ready: ${ms.toFixed(1)}ms (${registry.list().length} tools)\n`);
  }
  try {
    await program.parseAsync(argv);
  } catch (error) {
    handleError(error);
  }
}

function handleError(error: unknown): void {
  if (error instanceof CliError) {
    process.stderr.write(`${error.render()}\n`);
    process.exitCode = error.exitCode;
    return;
  }
  if (error instanceof CommanderError) {
    const isHelp = error.code === 'commander.helpDisplayed' || error.code === 'commander.version';
    process.exitCode = isHelp ? EXIT.OK : EXIT.USAGE;
    return;
  }
  throw error;
}
