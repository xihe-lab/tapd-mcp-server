// advisor 域轴 + 角色轴测试（S7，TAPD 需求 1139814312001001545）
// fixture 模板写在测试临时目录（TAPD_USER_TEMPLATES_DIR 注入），不污染 templates/pm/；
// 原子召回用真实 allTools registry（纯内存索引，不触 API）。

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { allTools, buildAdvisorIndex, recommend, ToolRegistry } from '@xihe-lab/tapd-core';
import { buildProgram } from '../program.js';
import { CliError } from '../errors.js';
import { DOMAIN_KEYWORDS, domainsInText, matchQueryDomains } from './domain-axis.js';
import { PERSONA_LABELS, parsePersona } from './persona.js';
import { advise } from './recall.js';
import { advisorJson, advisorNotes, renderAdvisorTable } from './render.js';
import { PM_DOMAINS } from '../pm/index.js';

// ---- fixture 模板（用户目录：当前 templates/pm/ 尚无域模板，S3-S6 并行开发中） ----

const RISK_SCAN = `name: risk-scan
domain: risk
title: 多源风险扫描（fixture）
write: false
steps:
  - id: iterations
    uses: tapd_get_iterations
    args: { status: open }
`;

const RISK_REGISTER = `name: risk-register
domain: risk
title: 风险登记册维护（fixture 写场景）
write: true
steps:
  - id: stories
    uses: tapd_get_stories
    args: { fields: "id,name" }
`;

const QUALITY_DASHBOARD = `name: quality-dashboard
domain: quality
title: 质量度量盘（fixture）
write: false
steps:
  - id: bugs
    uses: tapd_get_bugs
    args: { fields: "id,status" }
`;

const root = mkdtempSync(path.join(tmpdir(), 'tapd-advisor-domain-'));
mkdirSync(path.join(root, 'pm'), { recursive: true });
writeFileSync(path.join(root, 'pm', 'risk-scan.yaml'), RISK_SCAN);
writeFileSync(path.join(root, 'pm', 'risk-register.yaml'), RISK_REGISTER);
writeFileSync(path.join(root, 'pm', 'quality-dashboard.yaml'), QUALITY_DASHBOARD);
const prevEnv = process.env.TAPD_USER_TEMPLATES_DIR;
process.env.TAPD_USER_TEMPLATES_DIR = root;

const registry = new ToolRegistry();
registry.register(allTools);
const index = buildAdvisorIndex(registry);

function commands(hits: { command: string }[]): string[] {
  return hits.map(h => h.command);
}

const checks: [string, () => void | Promise<void>][] = [
  ['关键词表：八域齐备且与 PM_DOMAINS 同口径，每域中英文关键词都有', () => {
    assert.equal(DOMAIN_KEYWORDS.length, 8);
    assert.deepEqual(
      DOMAIN_KEYWORDS.map(e => e.domain),
      PM_DOMAINS.map(d => d.key),
      '域键顺序/集合必须与 pm 域表一致',
    );
    for (const entry of DOMAIN_KEYWORDS) {
      assert.ok(entry.keywords.length >= 4, `${entry.domain} 关键词过少`);
      assert.ok(entry.keywords.some(k => /^[a-z0-9]+$/.test(k)), `${entry.domain} 缺英文关键词`);
      assert.ok(entry.keywords.some(k => !/^[a-z0-9]+$/.test(k)), `${entry.domain} 缺中文关键词`);
      assert.ok(entry.zh.length > 0);
    }
  }],

  ['域匹配：中文子串命中、英文词边界命中（cost 不吃 process）', () => {
    assert.deepEqual(matchQueryDomains('帮我扫一遍风险预警'), ['risk']);
    assert.deepEqual(domainsInText('范围基线冻结与需求冻结'), ['scope']);
    assert.deepEqual(domainsInText('use evm metrics to watch cost'), ['cost']);
    assert.ok(!domainsInText('this is a process review').includes('cost'), 'cost 不得子串误命中 process');
    assert.ok(domainsInText('工时预算超支了').includes('cost'));
    assert.deepEqual(matchQueryDomains('列表'), [], '无域关键词的查询不得误触发域轴');
  }],

  ['域命中 → pm 场景候选置顶，写标识随模板透传', () => {
    const result = advise('看看迭代的风险', index);
    assert.deepEqual(result.matchedDomains, ['risk']);
    assert.equal(result.hits[0].kind, 'pm');
    assert.equal(result.hits[0].command, 'pm risk register');
    assert.equal(result.hits[0].write, true, 'write:true 的 pm 场景必须保留写标识');
    assert.equal(result.hits[1].command, 'pm risk scan');
    assert.equal(result.hits[1].write, false);
    assert.equal(result.hits[2].kind, 'atomic', 'pm 场景之后才是原子命令候选');
    assert.ok(result.hits.every(h => h.kind !== 'pm' || h.domains.includes('risk')));
    // usage 提示随写场景附 --yes
    assert.equal(result.hits[0].usage, 'tapd pm risk register [--iteration <id>] [--dry-run] [--yes]');
  }],

  ['多域命中：按域表序排 pm 场景（quality 在 risk 前），原子块稳定跟随', () => {
    const result = advise('风险和用例分诊一起看', index);
    assert.deepEqual(result.matchedDomains, ['quality', 'risk']);
    assert.deepEqual(
      commands(result.hits.filter(h => h.kind === 'pm')),
      ['pm quality dashboard', 'pm risk register', 'pm risk scan'],
    );
  }],

  ['未收录域：无模板自动跳过 pm 候选，退化为原子召回（给集成者的行为保证）', () => {
    const result = advise('冻结范围基线', index, { limit: 10 });
    assert.deepEqual(result.matchedDomains, ['scope']);
    assert.ok(result.hits.every(h => h.kind !== 'pm'), 'scope 无模板时不得出现 pm 候选');
    assert.ok(result.hits.length > 0, '域命中但无模板时仍应返回原子候选');
  }],

  ['无 persona 且无域命中：与 core recommend 顺序逐位一致（现有行为零变化）', () => {
    const result = advise('列表', index);
    assert.deepEqual(result.matchedDomains, []);
    const baseline = recommend('列表', index, 10).map(h => h.command);
    assert.deepEqual(commands(result.hits), baseline);
    assert.ok(result.hits.every(h => h.kind === 'atomic'));
    assert.equal(result.persona, undefined);
  }],

  ['--persona 三档对同一查询顺序可区分：dev 偏 task/story，qa 偏 bug，pm 偏 pm 场景+iteration/release', () => {
    // limit 放大到 20：确保 dev/qa/pm 三方关心的代表命令都留在窗口内可比
    const base = advise('列表', index, { limit: 20 });
    const dev = advise('列表', index, { persona: 'dev', limit: 20 });
    const qa = advise('列表', index, { persona: 'qa', limit: 20 });
    const pm = advise('列表', index, { persona: 'pm', limit: 20 });

    const idx = (hits: { command: string }[], cmd: string) => commands(hits).indexOf(cmd);
    const orderOf = (hits: { command: string }[]) => commands(hits).join(', ');
    assert.ok(idx(dev.hits, 'task list') < idx(dev.hits, 'bug list'), `dev: task list 应在 bug list 前: ${orderOf(dev.hits)}`);
    assert.ok(idx(dev.hits, 'story list') < idx(dev.hits, 'bug list'), `dev: story list 应在 bug list 前: ${orderOf(dev.hits)}`);
    assert.ok(idx(qa.hits, 'bug list') < idx(qa.hits, 'task list'), `qa: bug list 应在 task list 前: ${orderOf(qa.hits)}`);
    assert.ok(idx(qa.hits, 'bug list') < idx(qa.hits, 'story list'), `qa: bug list 应在 story list 前: ${orderOf(qa.hits)}`);
    assert.equal(pm.hits[0].kind, 'pm', 'pm persona 未命中域轴时也应注入 pm 场景候选');
    assert.ok(pm.hits.slice(0, 3).every(h => h.kind === 'pm'));
    const firstAtomic = pm.hits.find(h => h.kind === 'atomic')!.command;
    assert.match(firstAtomic, /^(iteration|release|report)\b/, `pm: 首个原子候选应为 iteration/release/report 类: ${firstAtomic}`);

    const orders = [commands(base.hits), commands(dev.hits), commands(qa.hits), commands(pm.hits)];
    for (let i = 0; i < orders.length; i++) {
      for (let j = i + 1; j < orders.length; j++) {
        assert.notDeepEqual(orders[i], orders[j], `第 ${i} 与 ${j} 档顺序必须可区分`);
      }
    }
  }],

  ['输出扩展：DOMAIN 列、说明行、JSON 扩展字段（tool/kind/domains/usage）', () => {
    const result = advise('看看迭代的风险', index, { persona: 'qa' });
    const table = renderAdvisorTable(result.hits);
    for (const fragment of ['COMMAND', 'WRITE', 'DOMAIN', 'DESCRIPTION', 'pm risk register', '✓']) {
      assert.ok(table.includes(fragment), `表格缺片段: ${fragment}`);
    }
    const notes = advisorNotes(result);
    assert.ok(notes.some(n => n.startsWith('domain: 命中知识域 risk')), `缺域命中说明: ${notes.join(' | ')}`);
    assert.ok(
      notes.some(n => n === `persona: qa —— ${PERSONA_LABELS.qa}`),
      `缺 persona 说明行: ${notes.join(' | ')}`,
    );
    const parsed = JSON.parse(advisorJson(result.hits)) as Record<string, unknown>[];
    const pmHit = parsed.find(h => h.kind === 'pm')!;
    assert.equal(pmHit.command, 'pm risk register');
    assert.equal(pmHit.write, true);
    assert.deepEqual(pmHit.domains, ['risk']);
    assert.equal(typeof pmHit.usage, 'string');
    assert.equal(pmHit.tool, undefined, 'pm 候选无底层工具名');
    const atomicHit = parsed.find(h => h.kind === 'atomic')!;
    assert.equal(typeof atomicHit.tool, 'string');
    assert.ok(Array.isArray(atomicHit.domains));
  }],

  ['未知 persona：parsePersona 报 INVALID_ARGS（exit 2），CLI 入口同样拒绝', async () => {
    assert.throws(
      () => parsePersona('boss'),
      (error: unknown) =>
        error instanceof CliError && error.code === 'INVALID_ARGS' && error.exitCode === 2
        && error.message.includes('dev') && error.message.includes('qa') && error.message.includes('pm'),
    );
    assert.equal(parsePersona(undefined), undefined);
    assert.equal(parsePersona('PM'), 'pm', '大小写不敏感');
    // 端到端：命令入口在发现模板/构建索引之前先校验 persona
    const program = buildProgram(registry, {});
    await assert.rejects(
      () => program.parseAsync(['node', 'tapd', 'advisor', '风险', '--persona', 'boss']),
      (error: unknown) => error instanceof CliError && error.code === 'INVALID_ARGS',
    );
  }],
];

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
  if (prevEnv === undefined) delete process.env.TAPD_USER_TEMPLATES_DIR;
  else process.env.TAPD_USER_TEMPLATES_DIR = prevEnv;
  rmSync(root, { recursive: true, force: true });
}
if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} passed`);
