// pm 模板发现 / 用户覆盖 / 别名解析 / 元数据剥离测试（S2）
// fixture 模板写在测试临时目录（TAPD_USER_TEMPLATES_DIR 注入），不污染 templates/pm/。

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PipelineError } from '../pipeline/types.js';
import { CliError } from '../errors.js';
import {
  discoverPmTemplates,
  loadPmTemplate,
  mergePmEntries,
  resolvePmEntry,
  userPmTemplatesDir,
  type PmTemplateEntry,
} from './discovery.js';
import { builtinPmTemplatesDir } from './discovery.js';

const RISK_SCAN = `# 多源风险扫描（fixture）
name: risk-scan
domain: risk
title: 风险扫描（fixture）
write: false
vars:
  iteration_id: ""
steps:
  - id: iterations
    uses: tapd_get_iterations
    args: { status: open, fields: "id,name,startdate" }
    filter: "!item.name.startsWith('zzz-delete-me')"
  - id: overdue
    uses: tapd_get_stories
    args: { iteration_id: "${'$'}{vars.iteration_id}" }
`;

const prevEnv = process.env.TAPD_USER_TEMPLATES_DIR;

function makeEntry(partial: Partial<PmTemplateEntry>): PmTemplateEntry {
  return {
    domain: 'risk',
    scenario: 'scan',
    name: 'risk-scan',
    title: '',
    write: false,
    file: '/tmp/x.yaml',
    source: 'builtin',
    domainKnown: true,
    ...partial,
  };
}

const checks: [string, () => void | Promise<void>][] = [
  ['内置目录 = builtinTemplatesDir()/pm，用户目录默认 ~/.tapd/templates/pm', () => {
    assert.ok(builtinPmTemplatesDir().endsWith(path.join('templates', 'pm')));
    assert.ok(userPmTemplatesDir().endsWith(path.join('pm')));
  }],
  ['发现：扫描用户目录，frontmatter domain 命中域表；坏文件降级为 warning 不炸', () => {
    process.env.TAPD_USER_TEMPLATES_DIR = root;
    try {
      const catalog = discoverPmTemplates();
      const scan = catalog.entries.find(e => e.scenario === 'scan');
      assert.ok(scan, 'risk-scan 应被收录');
      assert.equal(scan.domain, 'risk');
      assert.equal(scan.domainKnown, true);
      assert.equal(scan.source, 'user');
      assert.equal(scan.write, false);
      assert.equal(scan.name, 'risk-scan');
      assert.equal(scan.title, '风险扫描（fixture）');
      // broken.yaml（非法 yaml）与 no-steps.yaml（缺 steps）只产 warning
      assert.equal(catalog.warnings.length, 2);
      assert.ok(catalog.warnings.some(w => w.includes('broken.yaml')));
      assert.ok(catalog.warnings.some(w => w.includes('no-steps.yaml')));
      // 自定义域 procurement：domainKnown=false，仍被收录（可执行，help 归「其他」）
      const audit = catalog.entries.find(e => e.scenario === 'audit');
      assert.ok(audit);
      assert.equal(audit.domain, 'procurement');
      assert.equal(audit.domainKnown, false);
    } finally {
      if (prevEnv === undefined) delete process.env.TAPD_USER_TEMPLATES_DIR;
      else process.env.TAPD_USER_TEMPLATES_DIR = prevEnv;
    }
  }],
  ['用户同名覆盖内置（mergePmEntries 同别名 user 胜出）', () => {
    const builtin = [
      makeEntry({ source: 'builtin', file: '/builtin/risk-scan.yaml' }),
      makeEntry({ domain: 'scope', scenario: 'drift-check', name: 'scope-drift-check', file: '/builtin/scope-drift-check.yaml' }),
    ];
    const user = [makeEntry({ source: 'user', file: '/user/risk-scan.yaml', title: '用户版' })];
    const merged = mergePmEntries(builtin, user);
    assert.equal(merged.length, 2, '同别名只保留一份');
    const scan = merged.find(e => e.scenario === 'scan')!;
    assert.equal(scan.source, 'user');
    assert.equal(scan.title, '用户版');
    assert.equal(merged.find(e => e.scenario === 'drift-check')!.source, 'builtin');
    // 排序：域表序在前
    assert.ok(merged.findIndex(e => e.domain === 'scope') < merged.findIndex(e => e.domain === 'risk'));
  }],
  ['别名解析：命中 / 未知域 / 已知域缺场景（错误信息给可操作指引）', () => {
    const catalog = {
      entries: [
        makeEntry({ domain: 'risk', scenario: 'scan' }),
        makeEntry({ domain: 'risk', scenario: 'register', name: 'risk-register', write: true }),
      ],
      warnings: [],
    };
    const hit = resolvePmEntry(catalog, 'risk', 'scan');
    assert.equal(hit.file, '/tmp/x.yaml');
    // name 兜底匹配 <domain>-<scenario>
    assert.equal(resolvePmEntry(catalog, 'risk', 'register').write, true);

    assert.throws(
      () => resolvePmEntry(catalog, 'procurement', 'audit'),
      (error: unknown) => error instanceof CliError && error.code === 'INVALID_ARGS' && error.message.includes('未知域 "procurement"') && error.message.includes('integration, scope'),
    );
    assert.throws(
      () => resolvePmEntry(catalog, 'risk', 'nope'),
      (error: unknown) => error instanceof CliError && error.message.includes('域 risk 下没有场景 "nope"') && error.message.includes('scan, register'),
    );
    // 空目录的已知域：指引放模板即收录
    assert.throws(
      () => resolvePmEntry({ entries: [], warnings: [] }, 'risk', 'scan'),
      (error: unknown) => error instanceof CliError && error.message.includes('放置 templates/pm'),
    );
  }],
  ['loadPmTemplate：剥离 frontmatter domain 后交 S1 严格校验；坏结构抛 TEMPLATE_INVALID', () => {
    const ok = loadPmTemplate({ ...makeEntry({}), file: path.join(root, 'pm', 'risk-scan.yaml') });
    assert.equal(ok.template.name, 'risk-scan');
    assert.equal(ok.template.write, false);
    assert.equal(ok.template.steps.length, 2);
    assert.equal((ok.template as unknown as Record<string, unknown>).domain, undefined, 'domain 字段必须被剥离');
    assert.equal(ok.path, path.join(root, 'pm', 'risk-scan.yaml'));

    assert.throws(
      () => loadPmTemplate({ ...makeEntry({}), file: path.join(root, 'pm', 'broken.yaml') }),
      (error: unknown) => error instanceof PipelineError && error.code === 'TEMPLATE_INVALID',
    );
    assert.throws(
      () => loadPmTemplate({ ...makeEntry({}), file: '/nonexistent/nope.yaml' }),
      (error: unknown) => error instanceof PipelineError && error.code === 'IO',
    );
  }],
];

// ---- fixture 准备 ----
const root = mkdtempSync(path.join(tmpdir(), 'tapd-pm-discovery-'));
mkdirSync(path.join(root, 'pm'), { recursive: true });
writeFileSync(path.join(root, 'pm', 'risk-scan.yaml'), RISK_SCAN);
writeFileSync(
  path.join(root, 'pm', 'procurement-audit.yaml'),
  'name: procurement-audit\ndomain: procurement\ntitle: 外部依赖台账\nsteps:\n  - id: a\n    uses: tapd_get_stories\n',
);
writeFileSync(path.join(root, 'pm', 'broken.yaml'), 'name: [broken\n  steps: {{{');
writeFileSync(path.join(root, 'pm', 'no-steps.yaml'), 'name: no-steps\ntitle: 没有 steps\n');

let failed = 0;
try {
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
} finally {
  rmSync(root, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
