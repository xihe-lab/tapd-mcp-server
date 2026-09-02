import assert from 'node:assert/strict';
import { Command } from 'commander';
import { allTools } from '@xihe-lab/tapd-core';
import { bindSchemaFlags, toArgs } from './flags.js';

const utility = allTools.find(t => t.name === 'tapd_short_to_long_id')!;

function parseCommand(argv: string[]): Record<string, unknown> {
  const sub = new Command('convert');
  bindSchemaFlags(sub, utility, utility.cli);
  sub.exitOverride();
  sub.parse(argv, { from: 'user' });
  return sub.opts();
}

const checks: [string, () => void | Promise<void>][] = [
  ['bindSchemaFlags: boolean 字段未传时为 undefined（交给 zod default）', () => {
    const opts = parseCommand([]);
    assert.equal(opts.isCloud, undefined);
  }],
  ['bindSchemaFlags: --is-cloud 置 true', () => {
    const opts = parseCommand(['--is-cloud']);
    assert.equal(opts.isCloud, true);
  }],
  ['bindSchemaFlags: --no-is-cloud 置 false', () => {
    const opts = parseCommand(['--no-is-cloud']);
    assert.equal(opts.isCloud, false);
  }],
  ['toArgs + schema parse: 未传 is_cloud 走 zod default true', () => {
    const opts = parseCommand([]);
    const args = toArgs(utility, utility.cli, opts, [], { workspaceId: 39814312 });
    const parsed = utility.inputSchema.parse({ short_id: '123', ...args }) as Record<string, unknown>;
    assert.equal(parsed.is_cloud, true);
  }],
  ['toArgs + schema parse: --no-is-cloud 传导为 false', () => {
    const opts = parseCommand(['--no-is-cloud']);
    const args = toArgs(utility, utility.cli, opts, [], { workspaceId: 39814312 });
    const parsed = utility.inputSchema.parse({ short_id: '123', ...args }) as Record<string, unknown>;
    assert.equal(parsed.is_cloud, false);
  }],
];

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(error);
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
