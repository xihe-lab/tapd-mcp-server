import assert from 'node:assert/strict';
import { z } from 'zod';
import { allTools, ToolRegistry } from '../index.js';
import type { ToolDef } from '../types.js';
import { buildAdvisorIndex, recommend } from './index.js';

const registry = new ToolRegistry();
registry.register(allTools);
const index = buildAdvisorIndex(registry);

const checks: [string, () => Promise<void> | void][] = [
  ['index covers all registered tools', () => {
    assert.equal(index.length, registry.list().length);
    const storyUpdate = index.find(e => e.toolName === 'tapd_update_story')!;
    assert.equal(storyUpdate.command, 'story update');
    assert.equal(storyUpdate.isWrite, true);
    assert.equal(storyUpdate.weights.get('update'), 3);
    assert.equal(storyUpdate.weights.get('story'), 3);
  }],

  ['「切状态」story update 与 workflow status-map 进 top3', () => {
    const hits = recommend('切状态', index);
    const top3 = hits.slice(0, 3).map(h => h.command);
    assert.ok(top3.includes('workflow status-map'), `top3=${top3.join(', ')}`);
    assert.ok(top3.includes('story update'), `top3=${top3.join(', ')}`);
    const statusMap = hits.find(h => h.command === 'workflow status-map')!;
    assert.equal(statusMap.write, false);
    const storyUpdate = hits.find(h => h.command === 'story update')!;
    assert.equal(storyUpdate.write, true);
  }],

  ['「分给我」命中 assign 类命令', () => {
    const hits = recommend('分给我', index);
    assert.ok(hits.length > 0);
    assert.ok(hits.some(h => h.command.includes('assign')), hits.map(h => h.command).join(', '));
  }],

  ['「指派」同义命中 assign 类命令', () => {
    const hits = recommend('指派', index);
    assert.ok(hits.some(h => h.command.includes('assign')));
  }],

  ['「评论」命中 comment 类命令', () => {
    const hits = recommend('评论', index);
    assert.ok(hits.length > 0);
    assert.ok(
      hits.some(h => h.command === 'story comment' || h.command.startsWith('comment')),
      hits.map(h => h.command).join(', '),
    );
  }],

  ['「拉迭代」第一名为 iteration list', () => {
    const hits = recommend('拉迭代', index);
    assert.ok(hits.length > 0);
    assert.equal(hits[0].command, 'iteration list');
  }],

  ['英文模糊：creat 命中 create 类命令', () => {
    const hits = recommend('creat', index);
    assert.ok(hits.length > 0);
    assert.ok(hits.some(h => h.command.includes('create')), hits.map(h => h.command).join(', '));
  }],

  ['无关词返回空', () => {
    assert.equal(recommend('xyzabc', index).length, 0);
  }],

  ['空查询返回空', () => {
    assert.equal(recommend('', index).length, 0);
  }],

  ['limit 截断生效', () => {
    assert.ok(recommend('update', index, 3).length <= 3);
    assert.equal(recommend('update', index).length, 10);
  }],

  ['结果按分数降序排列', () => {
    const hits = recommend('需求列表', index);
    for (let i = 1; i < hits.length; i++) {
      assert.ok(hits[i - 1].score >= hits[i].score);
    }
  }],

  ['cli.alias 以 4 分参与召回', () => {
    const mini = new ToolRegistry();
    const aliased: ToolDef = {
      name: 'tapd_get_thing',
      description: 'demo',
      inputSchema: z.object({}),
      handler: () => Promise.resolve({}),
      cli: { resource: 'demo', action: 'run', alias: 'qswitch' },
    };
    mini.register([aliased]);
    const miniIndex = buildAdvisorIndex(mini);
    const hits = recommend('qswitch', miniIndex);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].tool, 'tapd_get_thing');
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    await check();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${checks.length}/${checks.length} passed`);
}
