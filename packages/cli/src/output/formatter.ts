import type { CliMeta, DerivedCommand, ExecResult } from '@xihe-lab/tapd-core';
import { renderTable } from './table.js';

export type OutputMode = 'text' | 'table' | 'json';

export interface FormatOptions {
  output?: OutputMode;
  isTTY: boolean;
  configuredFormat?: OutputMode;
  verbose?: boolean;
  meta?: CliMeta;
}

const DOMAIN_COLUMNS: Record<string, string[]> = {
  story: ['id', 'name', 'priority_label', 'owner', 'status'],
  bug: ['id', 'title', 'severity', 'current_owner', 'status'],
  task: ['id', 'name', 'owner', 'status'],
  iteration: ['id', 'name', 'startdate', 'enddate', 'status'],
  wiki: ['id', 'title', 'owner', 'created'],
};

const ENTITY_KEY = /^[A-Z]/;
const EMPTY = '(empty)';

function isEntityWrapped(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
  const rec = item as Record<string, unknown>;
  const keys = Object.keys(rec);
  return (
    keys.length === 1
    && ENTITY_KEY.test(keys[0])
    && rec[keys[0]] !== null
    && typeof rec[keys[0]] === 'object'
  );
}

export function unwrapEntity<T>(data: T): T {
  if (Array.isArray(data)) {
    const arr: unknown[] = data;
    if (arr.length === 0 || !isEntityWrapped(arr[0])) return data;
    return arr.map(item => (isEntityWrapped(item) ? item[Object.keys(item)[0]] : item)) as unknown as T;
  }
  if (isEntityWrapped(data)) return data[Object.keys(data)[0]] as T;
  return data;
}

function resolveAuto(data: unknown, opts: FormatOptions): OutputMode {
  if (!opts.isTTY) return 'json';
  return opts.configuredFormat ?? opts.meta?.outputFormat ?? (Array.isArray(data) ? 'table' : 'text');
}

function resolveColumns(resource: string, firstRow: Record<string, unknown>, meta?: CliMeta): string[] {
  if (meta?.columns?.length) return meta.columns;
  const domain = DOMAIN_COLUMNS[resource];
  if (domain) return domain;
  return Object.keys(firstRow).slice(0, 6);
}

function scalarText(v: unknown): string {
  switch (typeof v) {
    case 'string': return v;
    case 'number':
    case 'bigint':
    case 'boolean': return String(v);
    case 'symbol': return v.description ?? '';
    default: return '';
  }
}

function renderTextValue(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => {
      if (v === null) return `${k}: `;
      if (typeof v === 'object') {
        const json = JSON.stringify(v, null, 2)
          .split('\n')
          .map(l => `  ${l}`)
          .join('\n');
        return `${k}:\n${json}`;
      }
      return `${k}: ${scalarText(v)}`;
    })
    .join('\n');
}

function renderText(data: unknown): string {
  const unwrapped = unwrapEntity(data);
  if (Array.isArray(unwrapped)) {
    return unwrapped.map(item => renderTextValue(item)).join('\n\n');
  }
  return renderTextValue(unwrapped);
}

export function format(result: ExecResult, cmd: DerivedCommand, opts: FormatOptions): string {
  const { data } = result;
  const mode = opts.output ?? resolveAuto(data, opts);
  if (mode === 'json') {
    return data === undefined || data === null ? '[]' : JSON.stringify(data, null, 2);
  }
  if (mode === 'table' && Array.isArray(data)) {
    const list = unwrapEntity(data) as Record<string, unknown>[];
    if (list.length === 0) return EMPTY;
    return renderTable(
      list,
      resolveColumns(cmd.resource, list[0], opts.meta),
      opts.verbose ? Number.POSITIVE_INFINITY : undefined,
    );
  }
  if (data === undefined || data === null || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return EMPTY;
  }
  return renderText(data);
}
