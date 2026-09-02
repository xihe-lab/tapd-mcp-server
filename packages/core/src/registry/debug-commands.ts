import { allTools } from '../tools/index.js';
import { ToolRegistry } from './registry.js';

const outPath = process.argv[2];

const registry = new ToolRegistry();
registry.register(allTools);

const commands = registry.commands();
const writeCount = commands.filter(c => c.write).length;

const rows = commands.map(c => ({
  tool: c.tool,
  command: `td ${c.resource} ${c.action}`,
  write: c.write ? 'Y' : '',
  hidden: c.hidden ? 'Y' : '',
}));

const width = (header: string, get: (r: (typeof rows)[number]) => string): number =>
  Math.max(header.length, ...rows.map(r => get(r).length));

const pad = (s: string, w: number): string => s + ' '.repeat(Math.max(0, w - s.length));

const tw = width('TOOL', r => r.tool);
const cw = width('COMMAND', r => r.command);

const lines = [
  `total: ${commands.length} tools, write: ${writeCount}, read: ${commands.length - writeCount}`,
  '',
  pad('TOOL', tw) + '  ' + pad('COMMAND', cw) + '  WRITE  HIDDEN',
  ...rows.map(r => pad(r.tool, tw) + '  ' + pad(r.command, cw) + '  ' + pad(r.write, 5) + '  ' + r.hidden),
];

const seen = new Map<string, string[]>();
for (const c of commands) {
  const key = `${c.resource} ${c.action}`;
  const list = seen.get(key) ?? [];
  list.push(c.tool);
  seen.set(key, list);
}
const collisions = [...seen.entries()].filter(([, tools]) => tools.length > 1);

if (collisions.length > 0) {
  lines.push('', 'COLLISIONS (same command, multiple tools):');
  for (const [key, tools] of collisions) {
    lines.push(`  td ${key} <- ${tools.join(', ')}`);
  }
}

const output = lines.join('\n');
if (outPath) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outPath, output + '\n');
  console.error(`written to ${outPath}`);
} else {
  console.log(output);
}
