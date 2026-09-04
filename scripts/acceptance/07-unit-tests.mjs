import { Reporter, REPO, runCmd } from './helpers.mjs';

const r = new Reporter('07-unit-tests');

const core = await runCmd('pnpm', ['test'], { cwd: `${REPO}/packages/core`, timeoutMs: 180_000 });
r.check('core 测试执行成功 (退出码 0)', core.code === 0, (core.stderr || core.stdout).slice(-300));

const passedLines = (out) => [...`${out}`.matchAll(/(\d+)\/(\d+) (?:checks )?passed/g)].map(m => ({ pass: Number(m[1]), total: Number(m[2]) }));

const coreExpected = [['long-id-guard', 8], ['registry', 16], ['config', 21], ['export', 5], ['advisor', 12]];
const corePassed = passedLines(core.stdout);
for (const [label, count] of coreExpected) {
  const hit = corePassed.some(p => p.pass === count && p.total === count);
  r.check(`core ${label} ${count}/${count} passed`, hit, `实际 passed 行: ${corePassed.map(p => `${p.pass}/${p.total}`).join(', ') || core.stdout.slice(-200)}`);
}

const cli = await runCmd('pnpm', ['test'], { cwd: `${REPO}/packages/cli`, timeoutMs: 120_000 });
r.check('cli 测试执行成功 (退出码 0)', cli.code === 0, (cli.stderr || cli.stdout).slice(-300));

const cliExpected = [['formatter', 13], ['flags', 5]];
const cliPassed = passedLines(cli.stdout);
for (const [label, count] of cliExpected) {
  const hit = cliPassed.some(p => p.pass === count && p.total === count);
  r.check(`cli ${label} ${count}/${count} passed`, hit, `实际 passed 行: ${cliPassed.map(p => `${p.pass}/${p.total}`).join(', ') || cli.stdout.slice(-200)}`);
}

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
