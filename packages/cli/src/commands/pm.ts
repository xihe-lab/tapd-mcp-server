// tapd pm 命令组：管理语义层框架（S2，TAPD 需求 1139814312001001540）
//
// 红线（tapd-2.0.0-pm-layer-design.md §1.2）：pm 是编排层不是新实体——每个场景命令
// = 一份 pipeline 模板的语义别名，执行复用 S1 runPipeline 引擎，不直接实现新 API 调用。
//
// 结构：
//   tapd pm list [--domain <d>]              场景清单（域/场景/是否写/来源）
//   tapd pm <domain> <scenario> [flags]      别名执行（域子命令按目录发现动态注册）
//   tapd pm --help                           八域分组（中文 + 高项第4版章节号）
//   tapd pm <domain> --help                  该域场景清单
//
// 零代码注册：help 分组与域子命令清单由「模板发现 × 域表」动态渲染，后续波次往
// templates/pm/ 丢 yaml 即被收录（templates/pm/README.md 有约定说明）。

import type { Command } from 'commander';
import { resolveConfig, type TapdConfig, type ToolRegistry } from '@xihe-lab/tapd-core';
import { addGlobalOptions, makeClientFactory, parseOutputMode } from '../flags.js';
import { CliError } from '../errors.js';
import { EXIT } from '../exit-codes.js';
import { PM_DOMAINS, findDomain } from '../pm/index.js';
import {
  discoverPmTemplates,
  loadPmTemplate,
  resolvePmEntry,
  type PmCatalog,
} from '../pm/index.js';
import { probeDefaultIteration } from '../pm/index.js';
import { renderDomainHelp, renderPmHelp, renderPmList } from '../pm/index.js';
import type { RunSummary } from '../pipeline/index.js';
import { assertTemplateValid, runPipeline } from '../pipeline/index.js';

function stderr(line: string): void {
  process.stderr.write(line + '\n');
}

// 与 commands/pipeline.ts 的同名局部函数保持同构（该文件归 S1 所有，避免跨波次 diff）
function parseJsonInput(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new CliError('INVALID_ARGS', `--input 必须是合法 JSON: ${message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError('INVALID_ARGS', '--input 必须是 JSON 对象（模板变量表），如 --input \'{"iteration_id":"123"}\'');
  }
  return parsed as Record<string, unknown>;
}

function renderSummaryJson(summary: RunSummary): string {
  return JSON.stringify(
    {
      pipeline: summary.pipeline,
      ok: summary.ok,
      dryRun: summary.dryRun,
      gateBlocked: summary.gateBlocked,
      durationMs: summary.durationMs,
      steps: summary.steps.map(s => ({
        id: s.id,
        uses: s.uses,
        write: s.write,
        status: s.status,
        ...(s.skipReason ? { skipReason: s.skipReason } : {}),
        ...(s.error ? { error: s.error } : {}),
        ...(s.status === 'ok' ? { data: s.data } : {}),
      })),
      ...(summary.preview ? { preview: summary.preview } : {}),
      ...(summary.report !== undefined ? { report: summary.report } : {}),
    },
    null,
    2,
  );
}

export function registerPmCommand(program: Command, registry: ToolRegistry, config: TapdConfig): void {
  const catalog: PmCatalog = discoverPmTemplates();
  const pm = program.command('pm').description('管理语义层（软考高项知识域场景，编排既有原子命令）');
  addGlobalOptions(pm);
  pm.addHelpText('after', renderPmHelp(catalog));
  pm.action(() => {
    pm.outputHelp();
  });

  // ---- tapd pm list ----
  const list = pm
    .command('list')
    .description('列出可用的 pm 场景模板（内置 + 用户覆盖），显示 域/场景名/是否写')
    .option('--domain <key>', '按域过滤');
  addGlobalOptions(list);
  list.action((options: Record<string, unknown>, command: Command) => {
    const globals = { ...program.opts(), ...command.opts() };
    for (const w of catalog.warnings) stderr(`warning: ${w}`);
    let entries = catalog.entries;
    const domainFilter = options.domain as string | undefined;
    if (domainFilter) {
      if (!findDomain(domainFilter) && !entries.some(e => e.domain === domainFilter)) {
        throw new CliError('INVALID_ARGS', `未知域 "${domainFilter}"，可用域: ${PM_DOMAINS.map(d => d.key).join(', ')}`);
      }
      entries = entries.filter(e => e.domain === domainFilter);
    }
    const outputMode = parseOutputMode(globals.output);
    if (outputMode === 'json') {
      process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
    } else {
      process.stdout.write(renderPmList(entries) + '\n');
    }
  });

  // ---- tapd pm <domain> <scenario> ----
  // 域子命令 = 域表 8 域 ∪ 目录中发现的自定义域（后者 help 归「其他」，但同样可执行）
  const domainKeys = [...PM_DOMAINS.map(d => d.key), ...new Set(catalog.entries.filter(e => !e.domainKnown).map(e => e.domain))];
  for (const key of domainKeys) {
    const meta = findDomain(key);
    const sub = pm
      .command(key)
      .description(meta ? `${meta.zh}（高项第4版 ${meta.chapter}）场景命令` : '自定义域场景命令')
      .argument('<scenario>', `场景名（tapd pm ${key} --help 查看清单）`)
      .option('--iteration <id>', '迭代 ID 作用域（缺省自动取最新 open 迭代，过滤 zzz-delete-me*）')
      .option('--input <json>', '模板变量注入（JSON 对象），优先级低于 --iteration')
      .option('--dry-run', '只打印执行计划预览，不执行任何步骤')
      .option('--yes', '确认执行写步骤（含写步骤的模板缺省强制 dry-run 并拒绝落库）');
    addGlobalOptions(sub);
    sub.addHelpText('after', renderDomainHelp(key, catalog));
    sub.action(async (scenario: string, options: Record<string, unknown>, command: Command) => {
      await runScenario(program, registry, config, catalog, key, scenario, options, command);
    });
  }
}

/** 别名执行：解析模板 → 校验 → --iteration 缺省解析 → runPipeline（与 pipeline run 同构） */
async function runScenario(
  program: Command,
  registry: ToolRegistry,
  config: TapdConfig,
  catalog: PmCatalog,
  domainKey: string,
  scenario: string,
  options: Record<string, unknown>,
  command: Command,
): Promise<void> {
  for (const w of catalog.warnings) stderr(`warning: ${w}`);
  const entry = resolvePmEntry(catalog, domainKey, scenario);
  const { template } = loadPmTemplate(entry);
  assertTemplateValid(template, registry);

  const globals = { ...program.opts(), ...command.opts() };
  const vars: Record<string, unknown> = parseJsonInput(options.input as string | undefined);
  if (options.iteration) {
    vars.iteration_id = options.iteration;
  } else {
    const probe = await probeDefaultIteration(registry, makeClientFactory(globals), {
      defaultArgs: globals.workspaceId !== undefined ? { workspace_id: globals.workspaceId } : {},
      timeoutMs: resolveConfig(globals, config).timeoutMs,
    });
    if (probe.status === 'resolved') {
      vars.iteration_id = probe.iteration.id;
      stderr(`iteration: 自动选择 open 迭代 ${probe.iteration.id}${probe.iteration.name ? `（${probe.iteration.name}）` : ''}，可用 --iteration 覆盖`);
    } else if (probe.status === 'none') {
      stderr('warning: 未提供 --iteration 且未找到可用的 open 迭代（已过滤 zzz-delete-me*），模板将收到空迭代变量');
    } else {
      stderr(`warning: 默认迭代探测失败（${probe.message}），未注入迭代变量；可用 --iteration 显式指定`);
    }
  }

  const resolved = resolveConfig(globals, config);
  const summary = await runPipeline(
    template,
    {
      registry,
      clientFactory: makeClientFactory(globals),
      vars,
      defaultArgs: globals.workspaceId !== undefined ? { workspace_id: globals.workspaceId } : {},
      readOnly: resolved.readOnly,
      timeoutMs: resolved.timeoutMs,
      dryRun: Boolean(options.dryRun),
      yes: Boolean(options.yes),
      log: line => stderr(line),
    },
  );

  const outputMode = parseOutputMode(globals.output);
  if (outputMode === 'json') {
    process.stdout.write(renderSummaryJson(summary) + '\n');
  } else if (summary.report !== undefined) {
    process.stdout.write(summary.report + '\n');
  }
  if (summary.gateBlocked) {
    stderr('error: WRITE_GATE: 含写步骤的场景未加 --yes，已拒绝落库（确认后重跑，或保持 --dry-run 仅预览）');
    process.exitCode = EXIT.USAGE;
    return;
  }
  if (!summary.ok) {
    const failedSteps = summary.steps.filter(s => s.status === 'failed');
    stderr(`error: STEP_FAILED: 场景执行中断，${failedSteps.length} 个步骤失败: ${failedSteps.map(s => s.id).join(', ')}`);
    process.exitCode = EXIT.RUNTIME;
  }
}
