const ELLIPSIS = '…';

export function charWidth(ch: string): number {
  return ch.charCodeAt(0) > 0xFF ? 2 : 1;
}

export function strWidth(s: string): number {
  let width = 0;
  for (const ch of s) width += charWidth(ch);
  return width;
}

export function truncateDisplay(s: string, maxWidth: number): string {
  if (strWidth(s) <= maxWidth) return s;
  const budget = maxWidth - strWidth(ELLIPSIS);
  let width = 0;
  let out = '';
  for (const ch of s) {
    const cw = charWidth(ch);
    if (width + cw > budget) break;
    out += ch;
    width += cw;
  }
  return out + ELLIPSIS;
}

export function padDisplay(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - strWidth(s)));
}

function cellText(value: unknown): string {
  switch (typeof value) {
    case 'string': return value;
    case 'number':
    case 'bigint':
    case 'boolean': return String(value);
    case 'symbol': return value.description ?? '';
    case 'object': return value === null ? '' : JSON.stringify(value);
    default: return '';
  }
}

export function renderTable(
  rows: Record<string, unknown>[],
  columns: string[],
  maxColWidth = 40,
): string {
  const cells = (row: Record<string, unknown>) =>
    columns.map(col => truncateDisplay(cellText(row[col]), maxColWidth));
  const header = columns.map(col => truncateDisplay(col, maxColWidth));
  const widths = columns.map((_, i) =>
    Math.max(strWidth(header[i]), ...rows.map(row => strWidth(cells(row)[i]))),
  );
  const formatRow = (cells: string[]) =>
    cells.map((c, i) => padDisplay(c, widths[i])).join('  ');
  return [formatRow(header), widths.map(w => '-'.repeat(w)).join('  '), ...rows.map(row => formatRow(cells(row)))]
    .join('\n');
}
