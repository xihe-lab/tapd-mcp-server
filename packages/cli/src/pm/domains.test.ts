// pm 域元数据表与分组渲染测试（S2）

import assert from 'node:assert/strict';
import { PM_DOMAINS, PM_OTHER_DOMAIN_LABEL, domainLabel, findDomain } from './domains.js';
import { groupByDomain, renderDomainHelp, renderPmHelp, renderPmList } from './render.js';
import { pmAliasKey, splitAlias, type PmCatalog, type PmTemplateEntry } from './discovery.js';

function entry(partial: Partial<PmTemplateEntry>): PmTemplateEntry {
  return {
    domain: 'risk',
    scenario: 'scan',
    name: 'risk-scan',
    title: '',
    write: false,
    file: '/tmp/risk-scan.yaml',
    source: 'builtin',
    domainKnown: true,
    ...partial,
  };
}

const emptyCatalog: PmCatalog = { entries: [], warnings: [] };

const checks: [string, () => void | Promise<void>][] = [
  ['域表：8 域、键唯一、章节号格式、与设计 §2 顺序一致', () => {
    assert.equal(PM_DOMAINS.length, 8);
    assert.deepEqual(
      PM_DOMAINS.map(d => d.key),
      ['integration', 'scope', 'schedule', 'cost', 'quality', 'communication', 'risk', 'stakeholder'],
    );
    assert.equal(new Set(PM_DOMAINS.map(d => d.key)).size, 8);
    for (const d of PM_DOMAINS) {
      assert.match(d.chapter, /^第\d+章$/);
      assert.ok(d.zh.length > 0);
    }
    assert.deepEqual(
      PM_DOMAINS.map(d => d.chapter),
      ['第8章', '第9章', '第10章', '第11章', '第12章', '第14章', '第15章', '第17章'],
    );
  }],
  ['domainLabel：命中域表出中文名+章节号，未知归「其他」', () => {
    assert.equal(domainLabel('risk'), '风险管理（第15章）');
    assert.equal(domainLabel('communication'), '沟通管理（第14章）');
    assert.equal(domainLabel('procurement'), PM_OTHER_DOMAIN_LABEL);
    assert.equal(findDomain('nope'), undefined);
  }],
  ['groupByDomain：域表序在前，「其他」永远最后', () => {
    const groups = groupByDomain([
      entry({ domain: 'risk', scenario: 'scan' }),
      entry({ domain: 'procurement', scenario: 'audit', domainKnown: false }),
      entry({ domain: 'stakeholder', scenario: 'map' }),
      entry({ domain: '', scenario: 'orphan', domainKnown: false }),
    ]);
    const keys = groups.map(g => g.key);
    assert.deepEqual(keys, ['integration', 'scope', 'schedule', 'cost', 'quality', 'communication', 'risk', 'stakeholder', '']);
    assert.deepEqual(groups.at(-1)!.label, PM_OTHER_DOMAIN_LABEL);
    // 「其他」收编未知域与无域模板，known 域各归其位
    assert.deepEqual(groups.at(-1)!.entries.map(e => e.scenario), ['audit', 'orphan']);
    assert.equal(groups.find(g => g.key === 'risk')!.entries.length, 1);
    assert.equal(groups.find(g => g.key === 'integration')!.entries.length, 0);
  }],
  ['renderPmHelp：空目录也有八域骨架与收录提示（零代码注册入口）', () => {
    const help = renderPmHelp(emptyCatalog);
    for (const key of ['integration', 'scope', 'schedule', 'cost', 'quality', 'communication', 'risk', 'stakeholder']) {
      assert.ok(help.includes(key), `help 缺域键 ${key}`);
    }
    assert.ok(help.includes('整合管理（第8章）'));
    assert.ok(help.includes('干系人管理（第17章）'));
    assert.ok(help.includes('自动收录'));
    assert.ok(help.includes('--iteration'));
    assert.ok(help.includes('--dry-run'));
    assert.ok(help.includes('--yes'));
    assert.ok(help.includes('zzz-delete-me'));
  }],
  ['renderPmHelp：场景行带标题与 read/write 标记；未知域归「其他」且带域前缀', () => {
    const help = renderPmHelp({
      entries: [
        entry({ domain: 'risk', scenario: 'scan', title: '风险扫描（软考第15章）' }),
        entry({ domain: 'scope', scenario: 'baseline', write: true, title: '范围基线冻结' }),
        entry({ domain: 'procurement', scenario: 'audit', domainKnown: false }),
      ],
      warnings: [],
    });
    assert.ok(help.includes('scan              风险扫描（软考第15章） [read]'));
    assert.ok(help.includes('baseline          范围基线冻结 [write]'));
    assert.ok(help.includes('procurement/audit'));
    const otherIdx = help.indexOf(PM_OTHER_DOMAIN_LABEL);
    const stakeholderIdx = help.indexOf('stakeholder');
    assert.ok(otherIdx > stakeholderIdx, '「其他」组必须排在域表之后');
  }],
  ['renderDomainHelp：域标题带中文与章节号，场景对齐+写标记', () => {
    const help = renderDomainHelp('risk', {
      entries: [
        entry({ domain: 'risk', scenario: 'register', write: true, title: '登记册维护' }),
        entry({ domain: 'risk', scenario: 'scan', title: '风险扫描' }),
      ],
      warnings: [],
    });
    assert.ok(help.startsWith('risk 风险管理（第15章） 场景:'));
    assert.ok(help.includes('register          登记册维护 [write]'));
    assert.ok(help.includes('scan              风险扫描 [read]'));
    assert.ok(help.includes('用法: tapd pm risk <scenario>'));
    // 自定义域无域表元数据
    const custom = renderDomainHelp('procurement', { entries: [], warnings: [] });
    assert.ok(custom.includes('procurement（自定义域）'));
    assert.ok(custom.includes('暂无场景模板'));
  }],
  ['renderPmList：列头与域/场景/读写/来源/标题', () => {
    const list = renderPmList([
      entry({ domain: 'risk', scenario: 'scan', title: '风险扫描', source: 'builtin' }),
      entry({ domain: 'risk', scenario: 'register', title: '登记册', write: true, source: 'user' }),
    ]);
    const lines = list.split('\n');
    assert.equal(lines.length, 3);
    assert.match(lines[0], /^domain\s+scenario\s+mode\s+source\s+title$/);
    assert.match(lines[1], /^risk\s+scan\s+read\s+builtin\s+风险扫描$/);
    assert.match(lines[2], /^risk\s+register\s+write\s+user\s+登记册/);
    assert.ok(list.includes('用户覆盖内置'));
  }],
  ['renderPmList：空清单给收录指引', () => {
    const list = renderPmList([]);
    assert.ok(list.includes('暂无 pm 场景模板'));
    assert.ok(list.includes('自动收录'));
  }],
  ['splitAlias / pmAliasKey：文件名首个 - 拆域；frontmatter domain 优先', () => {
    assert.deepEqual(splitAlias('risk-scan'), { domain: 'risk', scenario: 'scan' });
    assert.deepEqual(splitAlias('scope-drift-check'), { domain: 'scope', scenario: 'drift-check' });
    assert.deepEqual(splitAlias('standup', 'schedule'), { domain: 'schedule', scenario: 'standup' });
    assert.deepEqual(splitAlias('drift-check', 'scope'), { domain: 'scope', scenario: 'drift-check' });
    assert.deepEqual(splitAlias('orphan'), { domain: '', scenario: 'orphan' });
    assert.equal(pmAliasKey({ domain: 'risk', scenario: 'scan' }), 'risk::scan');
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
