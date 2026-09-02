import { readFileSync } from 'node:fs';

const curPath = process.argv[2];
const cur = JSON.parse(readFileSync(curPath, 'utf8')).tools;
const base = JSON.parse(readFileSync('/tmp/claude/baseline-tools.json', 'utf8')).tools;

const curNames = cur.map(t => t.name);
const baseNames = base.map(t => t.name);
if (new Set(curNames).size !== curNames.length) throw new Error('duplicate tool names');

const baseSet = new Set(baseNames);
const curSet = new Set(curNames);
const added = curNames.filter(n => !baseSet.has(n));
const removed = baseNames.filter(n => !curSet.has(n));
const baseMap = Object.fromEntries(base.map(t => [t.name, t]));
const curMap = Object.fromEntries(cur.map(t => [t.name, t]));
const drifted = baseNames.filter(n => curSet.has(n) && JSON.stringify(baseMap[n]) !== JSON.stringify(curMap[n]));

console.log(`current: ${curNames.length}, baseline: ${baseNames.length}`);
console.log(`added: ${JSON.stringify(added)}`);
console.log(`removed: ${JSON.stringify(removed)}`);
console.log(`drifted(210 subset): ${drifted.length ? drifted.join(',') : 'NONE'}`);

const ok = curNames.length === 212
  && JSON.stringify(added) === JSON.stringify(['tapd_md_to_html', 'tapd_html_to_md'])
  && removed.length === 0
  && drifted.length === 0;
console.log(ok ? 'ZERO-DRIFT OK' : 'ZERO-DRIFT FAILED');
process.exitCode = ok ? 0 : 1;
