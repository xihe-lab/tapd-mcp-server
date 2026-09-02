import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scripts = [
  '01-mcp-bin-stdio.mjs',
  '02-tools-parity.mjs',
  '03-error-behavior.mjs',
  '04-env-isolation.mjs',
  '05-cli-quality.mjs',
  '06-dual-entry-error.mjs',
  '07-unit-tests.mjs',
  '08-package-size.mjs',
  '09-extensibility.mjs',
  // 第二层（需真凭证 + 网络，会创建 zzz-delete-me- 测试数据）
  '10-dual-entry-data.mjs',
  '11-oauth-write.mjs',
  '12-sdk-fetch.mjs',
  '13-old-mcp-data.mjs',
  '14-credential-masking.mjs',
  '15-performance.mjs',
  '16-richtext-auto.mjs',
];

const dir = fileURLToPath(new URL('.', import.meta.url));
const only = process.argv[2] ? [process.argv[2]] : scripts;
const results = [];

for (const script of only) {
  console.log(`\n========== ${script} ==========`);
  const started = Date.now();
  const res = spawnSync('node', [dir + script], { cwd: dir, stdio: 'inherit', timeout: 300_000 });
  results.push({ script, code: res.status ?? -1, ms: Date.now() - started });
}

console.log('\n================ 汇总 ================');
let failed = 0;
for (const res of results) {
  const status = res.code === 0 ? 'PASS' : 'FAIL';
  if (res.code !== 0) failed++;
  console.log(`${status}  ${res.script}  (${res.ms}ms)`);
}
console.log(`\n${only.length - failed}/${only.length} 脚本通过`);
process.exit(failed > 0 ? 1 : 0);
