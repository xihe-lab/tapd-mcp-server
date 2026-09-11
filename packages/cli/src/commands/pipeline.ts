// tapd pipeline 命令组：run / validate / record / list（S1 引擎本体的 CLI 入口）
// PipelineError 由 main 的 handleError 统一渲染（render() 与 CliError 同前缀风格）。

import { writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import { resolveConfig, resolveWrite, type TapdConfig, type ToolRegistry } from '@xihe-lab/tapd-core';
import { addGlobalOptions, makeClientFactory, parseOutputMode } from '../flags.js';
import { CliError } from '../errors.js';
import { EXIT } from '../exit-codes.js';
import {
  assertTemplateValid,
  buildTemplateFromHistory,
  formatIssues,
  listBuiltinTemplates,
  loadTemplate,
  readHistory,
  renderTemplateYaml,
  runPipeline,
  validateTemplate,
} from '../pipeline/index.js';
import type { RunSummary } from '../pipeline/index.js';

function stderr(line: string): void {
  process.stderr.write(line + '\n');
}

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

function writeEventsFile(filePath: string, content: string): void {
  writeFileSync(filePath, content);
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

export function registerPipelineCommand(program: Command, registry: ToolRegistry, config: TapdConfig): void {
  const pipeline = program.command('pipeline').description('工作流编排引擎（yaml/json 模板，F8）');
  addGlobalOptions(pipeline);

  const run = pipeline
    .command('run')
    .description('执行工作流模板（写步骤默认 dry-run 闸门，--yes 确认落库）')
    .argument('<file>', '模板路径，或内置模板名（如 iteration-review）')
    .option('--input <json>', '模板变量注入（JSON 对象），优先级高于模板 vars')
    .option('--iteration <id>', '迭代 ID 便捷注入（等价 --input \'{"iteration_id":"<id>"}\'）')
    .option('--dry-run', '只打印执行计划预览，不执行任何步骤')
    .option('--yes', '确认执行写步骤（含写步骤的模板缺省时强制 dry-run 并拒绝落库）')
    .option('--events <file>', '事件流 JSONL 输出路径');
  run.addHelpText(
    'after',
    [
      'Examples:',
      '  $ tapd pipeline run templates/iteration-review.yaml --iteration 1001',
      '  $ tapd pipeline run deliver-story --input \'{"story_id":"1140..."}\' --yes',
      '  $ tapd pipeline run triage-bugs.yaml --dry-run --events run.jsonl',
    ].join('\n'),
  );
  addGlobalOptions(run);
  run.action(async (file: string, options: Record<string, unknown>, command: Command) => {
    const globals = { ...program.opts(), ...command.opts() };
    const input = parseJsonInput(options.input as string | undefined);
    const vars: Record<string, unknown> = {
      ...(options.iteration ? { iteration_id: options.iteration } : {}),
      ...input,
    };
    const { template } = loadTemplate(file);
    assertTemplateValid(template, registry);
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
        eventsPath: options.events as string | undefined,
        log: line => stderr(line),
      },
      writeEventsFile,
    );

    const outputMode = parseOutputMode(globals.output);
    if (outputMode === 'json') {
      process.stdout.write(renderSummaryJson(summary) + '\n');
    } else if (summary.report !== undefined) {
      process.stdout.write(summary.report + '\n');
    }
    if (summary.gateBlocked) {
      stderr('error: WRITE_GATE: 含写步骤的模板未加 --yes，已拒绝落库（确认后重跑，或保持 --dry-run 仅预览）');
      process.exitCode = EXIT.USAGE;
      return;
    }
    if (!summary.ok) {
      const failedSteps = summary.steps.filter(s => s.status === 'failed');
      stderr(`error: STEP_FAILED: pipeline 中断，${failedSteps.length} 个步骤失败: ${failedSteps.map(s => s.id).join(', ')}`);
      process.exitCode = EXIT.RUNTIME;
    }
  });

  const validate = pipeline
    .command('validate')
    .description('静态校验模板：命令存在性、参数 zod schema、写步骤标记、表达式语法、引用完整性')
    .argument('<file>', '模板路径，或内置模板名')
    .option('--json', '以 JSON 输出校验结果');
  addGlobalOptions(validate);
  validate.action((file: string, options: { json?: boolean }) => {
    const { template, path } = loadTemplate(file);
    const result = validateTemplate(template, registry);
    if (options.json) {
      process.stdout.write(
        JSON.stringify(
          { ok: result.ok, template: template.name, path, errors: result.errors, warnings: result.warnings, writeSteps: result.writeSteps },
          null,
          2,
        ) + '\n',
      );
    } else {
      const lines = [
        `template: ${template.name} (${path})`,
        `write steps: ${result.writeSteps.length ? result.writeSteps.join(', ') : '(none)'}`,
      ];
      if (result.errors.length) lines.push(formatIssues(result.errors));
      if (result.warnings.length) lines.push(formatIssues(result.warnings));
      lines.push(result.ok ? '✓ 校验通过' : `✗ 校验未通过（${result.errors.length} 个错误）`);
      process.stdout.write(lines.join('\n') + '\n');
    }
    if (!result.ok) process.exitCode = EXIT.USAGE;
  });

  const record = pipeline
    .command('record')
    .description('把最近执行的 CLI 命令历史录制为 yaml 模板（数据源 ~/.tapd/history.jsonl）')
    .option('--last <n>', '取最近 N 条成功命令', '20')
    .option('--name <name>', '模板名', 'recorded-pipeline')
    .option('--title <title>', '模板标题')
    .option('--out <file>', '写入文件而非 stdout');
  addGlobalOptions(record);
  record.action((options: Record<string, unknown>) => {
    const limit = Number.parseInt(options.last as string, 10);
    if (Number.isNaN(limit) || limit <= 0) {
      throw new CliError('INVALID_ARGS', `--last 必须是正整数，got "${String(options.last)}"`);
    }
    const entries = readHistory(limit);
    if (entries.length === 0) {
      stderr('error: STEP_FAILED: 命令历史为空，先执行若干 tapd 命令再录制（TAPD_CLI_NO_HISTORY=1 会关闭记录）');
      process.exitCode = EXIT.RUNTIME;
      return;
    }
    const template = buildTemplateFromHistory(
      entries,
      { name: options.name as string, title: options.title as string | undefined },
      tool => {
        const def = registry.get(tool);
        return def ? resolveWrite(def) : false;
      },
    );
    const yaml = renderTemplateYaml(template);
    const out = options.out as string | undefined;
    if (out) {
      writeFileSync(out, yaml);
      process.stdout.write(`recorded ${entries.length} command(s) → ${out}\n`);
    } else {
      process.stdout.write(yaml);
    }
  });

  const list = pipeline.command('list').description('列出内置模板');
  addGlobalOptions(list);
  list.action(() => {
    for (const tpl of listBuiltinTemplates()) {
      process.stdout.write(`${tpl.write ? '[write]' : '[read] '} ${tpl.name}${tpl.title ? ` — ${tpl.title}` : ''}\n`);
    }
  });
}
