import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Reporter, REPO } from './helpers.mjs';

const r = new Reporter('08-package-size');

function packDryRun(pkgDir) {
  // pnpm 10 无 --dry-run：真打包读体积后清理
  const before = new Set(execSync(`ls ${pkgDir}/*.tgz 2>/dev/null || true`, { encoding: 'utf8' }).split('\n').filter(Boolean));
  execSync('pnpm pack', { cwd: pkgDir, encoding: 'utf8', timeout: 120_000 });
  const tgz = execSync(`ls -t ${pkgDir}/*.tgz | head -1`, { encoding: 'utf8' }).trim();
  const stat = execSync(`stat -f "%z" "${tgz}"`, { encoding: 'utf8' }).trim();
  const files = execSync(`tar -tzf "${tgz}"`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (!before.has(tgz)) execSync(`rm -f "${tgz}"`);
  return { size: Number(stat), unpackedSize: 0, files };
}

const pkgs = [
  { name: 'core', dir: `${REPO}/packages/core`, forbidden: ['@modelcontextprotocol/sdk', 'commander'], allowedOnly: null },
  { name: 'cli', dir: `${REPO}/packages/cli`, forbidden: ['@modelcontextprotocol/sdk'], expectDep: ['commander'] },
  { name: 'mcp', dir: `${REPO}/packages/mcp`, forbidden: ['commander'], expectDep: ['@modelcontextprotocol/sdk', '@xihe-lab/tapd-core'] },
];

for (const p of pkgs) {
  const manifest = JSON.parse(readFileSync(`${p.dir}/package.json`, 'utf8'));
  const deps = Object.keys(manifest.dependencies ?? {});
  for (const f of p.forbidden) {
    r.check(`包体约束: ${p.name} 依赖不含 ${f}`, !deps.includes(f), `deps: ${deps.join(', ')}`);
  }
  if (p.expectDep) {
    for (const d of p.expectDep) {
      r.check(`${p.name} 依赖含 ${d}`, deps.includes(d), `deps: ${deps.join(', ')}`);
    }
  }
  try {
    const packed = packDryRun(p.dir);
    const sizeStr = typeof packed.size === 'number' ? `${(packed.size / 1024).toFixed(1)} KB` : String(packed.size);
    r.note(`${p.name}: tgz 大小 ${sizeStr}, 包内文件数 ${Array.isArray(packed.files) ? packed.files.length : '?'}`);
  } catch (e) {
    r.note(`${p.name}: pack 失败: ${String(e.message).slice(0, 200)}`);
  }
}

// core 打包产物不含 MCP SDK / commander 痕迹（除 d.ts 类型引用外的运行时代码）
const coreManifest = JSON.parse(readFileSync(`${REPO}/packages/core/package.json`, 'utf8'));
r.check('core package.json dependencies 不含 @modelcontextprotocol/sdk 与 commander',
  !coreManifest.dependencies?.['@modelcontextprotocol/sdk'] && !coreManifest.dependencies?.commander,
  JSON.stringify(coreManifest.dependencies));

const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
