// 命令执行历史（pipeline record 的数据源）
//
// CLI 一进程一命令，"本进程最近执行的命令序列" 跨进程落在 ~/.tapd/history.jsonl：
//   - program.ts 的 runCommand 经 ExecContext.onAudit 钩子写入（成功才记，凭证字段由
//     registry 的审计脱敏保证 token/password 类值已替换为 '***'）
//   - pipeline 步骤 exec 不挂该钩子，模板内部步骤不会被录进历史
//   - 环境开关 TAPD_CLI_NO_HISTORY=1 可整体关闭

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AuditEvent } from '@xihe-lab/tapd-core';

export interface HistoryEntry {
  ts: string;
  tool: string;
  args: Record<string, unknown>;
  durationMs: number;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const KEEP_ON_TRIM = 500;

export function historyPath(): string {
  return process.env.TAPD_HISTORY_PATH ?? path.join(os.homedir(), '.tapd', 'history.jsonl');
}

export function historyEnabled(): boolean {
  return process.env.TAPD_CLI_NO_HISTORY !== '1';
}

/** ExecContext.onAudit 钩子实现：仅记录成功的 cli 命令，失败静默（历史文件绝不影响命令本身） */
export function recordCommandHistory(event: AuditEvent): void {
  if (!historyEnabled()) return;
  if (!event.ok) return;
  try {
    const file = historyPath();
    mkdirSync(path.dirname(file), { recursive: true });
    trimIfNeeded(file);
    const entry: HistoryEntry = { ts: event.ts, tool: event.tool, args: event.args, durationMs: event.durationMs };
    appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch {
    // 历史记录为尽力而为，任何 IO 失败都不打断命令执行
  }
}

function trimIfNeeded(file: string): void {
  try {
    if (!existsSync(file)) return;
    if (statSync(file).size < MAX_FILE_BYTES) return;
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    writeFileSync(file, lines.slice(-KEEP_ON_TRIM).join('\n') + '\n');
  } catch {
    // 修剪失败不影响追加
  }
}

export function readHistory(limit: number, file = historyPath()): HistoryEntry[] {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').trimEnd().split('\n').filter(Boolean);
  const out: HistoryEntry[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      const parsed = JSON.parse(line) as HistoryEntry;
      if (parsed && typeof parsed.tool === 'string') out.push(parsed);
    } catch {
      // 跳过损坏行
    }
  }
  return out;
}
