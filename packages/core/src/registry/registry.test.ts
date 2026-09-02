import assert from 'node:assert/strict';
import { z } from 'zod';
import type { ToolDef } from '../types.js';
import type { TapdClient } from '../tapd-client.js';
import type { AuditEvent, CliErrorCode } from './registry.js';
import { ToolRegistry } from './registry.js';
import { resolveWrite } from './write-policy.js';
import { deriveCommand } from './derive-command.js';

function makeTool(overrides: Partial<ToolDef> & { name: string }): ToolDef {
  return {
    description: 'test tool',
    inputSchema: z.object({}),
    handler: () => Promise.resolve({ done: true }),
    ...overrides,
  } as ToolDef;
}

const fakeFactory = () => ({}) as TapdClient;

const checks: [string, () => Promise<void> | void][] = [
  ['register throws on duplicate tool name', () => {
    const registry = new ToolRegistry();
    registry.register([makeTool({ name: 'tapd_a' })]);
    assert.throws(() => registry.register([makeTool({ name: 'tapd_a' })]), /Duplicate tool name/);
  }],

  ['get / list / commands expose registered tools', () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({ name: 'tapd_get_stories' }),
      makeTool({ name: 'tapd_create_bugs' }),
    ]);
    assert.ok(registry.get('tapd_get_stories'));
    assert.equal(registry.get('tapd_missing'), undefined);
    assert.equal(registry.list().length, 2);
    const commands = registry.commands();
    assert.equal(commands.length, 2);
    const storyList = commands.find(c => c.tool === 'tapd_get_stories')!;
    assert.equal(storyList.resource, 'story');
    assert.equal(storyList.action, 'list');
    assert.equal(storyList.write, false);
    const bugCreate = commands.find(c => c.tool === 'tapd_create_bugs')!;
    assert.equal(bugCreate.write, true);
  }],

  ['exec step 1: unknown tool -> TOOL_NOT_FOUND', async () => {
    const registry = new ToolRegistry();
    const result = await registry.exec('tapd_missing', {}, { entry: 'mcp' }, fakeFactory);
    assert.deepEqual(result, {
      ok: false,
      error: { code: 'TOOL_NOT_FOUND', message: 'Tool not found: tapd_missing' },
    });
  }],

  ['exec step 2: invalid args -> INVALID_ARGS with human-readable message', async () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({
        name: 'tapd_need_fields',
        inputSchema: z.object({
          status: z.string(),
          limit: z.number(),
        }),
      }),
    ]);
    const result = await registry.exec('tapd_need_fields', { limit: 'abc' }, { entry: 'cli' }, fakeFactory);
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'INVALID_ARGS');
    assert.match(result.error?.message ?? '', /status: Required/);
    assert.match(result.error?.message ?? '', /limit: /);
  }],

  ['exec step 2: zod defaults are filled into parsed args', async () => {
    const registry = new ToolRegistry();
    let received: unknown;
    registry.register([
      makeTool({
        name: 'tapd_with_default',
        inputSchema: z.object({ max_workers: z.number().optional().default(3) }),
        handler: (_client, params) => {
          received = params;
          return Promise.resolve(params);
        },
      }),
    ]);
    const result = await registry.exec('tapd_with_default', {}, { entry: 'cli' }, fakeFactory);
    assert.equal(result.ok, true);
    assert.deepEqual(received, { max_workers: 3 });
  }],

  ['exec step 3: readOnly blocks write tools but not read tools', async () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({ name: 'tapd_create_story' }),
      makeTool({ name: 'tapd_get_stories' }),
    ]);
    const blocked = await registry.exec('tapd_create_story', {}, { entry: 'cli', readOnly: true }, fakeFactory);
    assert.equal(blocked.error?.code, 'READ_ONLY_BLOCKED');

    const allowed = await registry.exec('tapd_get_stories', {}, { entry: 'cli', readOnly: true }, fakeFactory);
    assert.equal(allowed.ok, true);

    const writeAllowed = await registry.exec('tapd_create_story', {}, { entry: 'cli' }, fakeFactory);
    assert.equal(writeAllowed.ok, true);
  }],

  ['exec step 3: explicit write:false overrides verb inference', async () => {
    const registry = new ToolRegistry();
    registry.register([makeTool({ name: 'tapd_update_special', write: false })]);
    const result = await registry.exec('tapd_update_special', {}, { entry: 'cli', readOnly: true }, fakeFactory);
    assert.equal(result.ok, true);
  }],

  ['exec step 4: clientFactory failure -> AUTH_MISSING', async () => {
    const registry = new ToolRegistry();
    registry.register([makeTool({ name: 'tapd_get_stories' })]);
    const missing = await registry.exec('tapd_get_stories', {}, { entry: 'cli' });
    assert.equal(missing.error?.code, 'AUTH_MISSING');

    const throwing = await registry.exec(
      'tapd_get_stories',
      {},
      { entry: 'cli' },
      () => { throw new Error('TAPD_ACCESS_TOKEN is required'); },
    );
    assert.equal(throwing.error?.code, 'AUTH_MISSING');
    assert.match(throwing.error?.message ?? '', /TAPD_ACCESS_TOKEN/);
  }],

  ['exec step 5: handler exceeding timeout -> TIMEOUT', async () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({ name: 'tapd_slow', handler: () => new Promise<never>(() => undefined) }),
    ]);
    const result = await registry.exec('tapd_slow', {}, { entry: 'cli', timeoutMs: 30 }, fakeFactory);
    assert.equal(result.error?.code, 'TIMEOUT');
  }],

  ['exec step 6: handler throw -> API_ERROR with original message', async () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({ name: 'tapd_boom', handler: () => Promise.reject(new Error('TAPD API error: permission denied')) }),
    ]);
    const result = await registry.exec('tapd_boom', {}, { entry: 'mcp' }, fakeFactory);
    assert.equal(result.error?.code, 'API_ERROR');
    assert.equal(result.error?.message, 'TAPD API error: permission denied');
  }],

  ['exec step 6: success returns raw handler data unwrapped', async () => {
    const registry = new ToolRegistry();
    registry.register([makeTool({ name: 'tapd_ok', handler: () => Promise.resolve({ list: [1, 2] }) })]);
    const result = await registry.exec<{ list: number[] }>('tapd_ok', {}, { entry: 'mcp' }, fakeFactory);
    assert.deepEqual(result.data, { list: [1, 2] });
  }],

  ['exec step 7: audit event fires on success and failure with sanitized args', async () => {
    const registry = new ToolRegistry();
    registry.register([
      makeTool({ name: 'tapd_ok' }),
      makeTool({ name: 'tapd_boom', handler: () => Promise.reject(new Error('boom')) }),
      makeTool({
        name: 'tapd_secret',
        inputSchema: z.object({ api_password: z.string().optional() }),
      }),
    ]);
    const events: string[] = [];

    await registry.exec('tapd_ok', {}, { entry: 'cli', onAudit: e => events.push(`${e.tool}:${e.ok}`) }, fakeFactory);
    await registry.exec('tapd_boom', {}, { entry: 'cli', onAudit: e => events.push(`${e.tool}:${e.ok}:${e.errorCode}`) }, fakeFactory);

    let captured: AuditEvent | undefined;
    await registry.exec('tapd_secret', { api_password: 'hunter2' }, { entry: 'cli', onAudit: e => { captured = e; } }, fakeFactory);
    assert.deepEqual(captured?.args, { api_password: '***' });
    assert.ok(typeof captured?.durationMs === 'number');
    assert.ok(captured?.ts);

    assert.deepEqual(events, ['tapd_ok:true', 'tapd_boom:false:API_ERROR']);
  }],

  ['exec: error paths emit audit with expected codes', async () => {
    const registry = new ToolRegistry();
    const codes: (CliErrorCode | undefined)[] = [];
    const audit = (e: AuditEvent) => codes.push(e.errorCode);

    await registry.exec('tapd_missing', {}, { entry: 'cli', onAudit: audit });
    assert.equal(codes.at(-1), 'TOOL_NOT_FOUND');

    registry.register([makeTool({ name: 'tapd_bad_args', inputSchema: z.object({ id: z.string() }) })]);
    await registry.exec('tapd_bad_args', {}, { entry: 'cli', onAudit: audit });
    assert.equal(codes.at(-1), 'INVALID_ARGS');

    registry.register([makeTool({ name: 'tapd_create_x' })]);
    await registry.exec('tapd_create_x', {}, { entry: 'cli', readOnly: true, onAudit: audit });
    assert.equal(codes.at(-1), 'READ_ONLY_BLOCKED');
  }],

  ['write-policy: verb regex inference', () => {
    const write = (name: string) => resolveWrite(makeTool({ name }));
    for (const name of [
      'tapd_create_story', 'tapd_update_bug', 'tapd_delete_timesheets', 'tapd_add_baseline',
      'tapd_copy_story', 'tapd_batch_update_stories', 'tapd_save_time_relations', 'tapd_remove_story_bug_relations',
      'tapd_execute_tcase_instance', 'tapd_lock_iteration', 'tapd_unlock_iteration', 'tapd_assign_tcase_instance',
      'tapd_link_bugs', 'tapd_set_tag',
    ]) {
      assert.equal(write(name), true, name);
    }
    for (const name of [
      'tapd_get_stories', 'tapd_get_bug_count', 'tapd_change_workitem_type', 'tapd_batch_fetch_bugs',
      'tapd_get_workflow_status_map',
    ]) {
      assert.equal(write(name), false, name);
    }
  }],

  ['write-policy: change_workitem_type explicit write after registry merge', () => {
    const registry = new ToolRegistry();
    registry.register([makeTool({ name: 'tapd_change_workitem_type' })]);
    const tool = registry.get('tapd_change_workitem_type')!;
    assert.equal(resolveWrite(tool), true);
    assert.equal(tool.cli?.action, 'set-type');
  }],

  ['derive-command: FSD 4.1.2 examples', () => {
    assert.deepEqual(deriveCommand('tapd_get_stories'), { resource: 'story', action: 'list' });
    assert.deepEqual(deriveCommand('tapd_get_story_count'), { resource: 'story', action: 'count' });
    assert.deepEqual(deriveCommand('tapd_create_story'), { resource: 'story', action: 'create' });
    assert.deepEqual(deriveCommand('tapd_update_story'), { resource: 'story', action: 'update' });
    assert.deepEqual(deriveCommand('tapd_get_story_changes'), { resource: 'story', action: 'changes' });
    assert.deepEqual(deriveCommand('tapd_get_workflow_status_map'), { resource: 'workflow', action: 'status-map' });
    assert.deepEqual(deriveCommand('tapd_get_test_plans'), { resource: 'test-plan', action: 'list' });
    assert.deepEqual(deriveCommand('tapd_mini_get_items'), { resource: 'mini-item', action: 'list' });
    assert.deepEqual(deriveCommand('tapd_batch_update_stories'), { resource: 'story', action: 'batch-update' });
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
