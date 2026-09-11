// richtext 语义库内部工具：最小 HTML 转义/反解（零依赖、纯函数）。
// 只覆盖 TAPD 富文本锚点/at-who 生成与解析所需的最小集合，不做完整 HTML 实体表。

const TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

const ATTR_ESCAPES: Readonly<Record<string, string>> = {
  ...TEXT_ESCAPES,
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML 文本节点转义（& < >）。 */
export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>]/g, (ch) => TEXT_ESCAPES[ch] ?? ch);
}

/** HTML 属性值转义（& < > " '）。 */
export function escapeHtmlAttr(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ATTR_ESCAPES[ch] ?? ch);
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** 反解 TAPD 富文本属性值中可能出现的实体（常用命名实体 + 十进制/十六进制数字实体）。未识别的实体原样保留。 */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    const codePoint = numericEntityCodePoint(body);
    if (codePoint !== null) return safeFromCodePoint(codePoint, whole);
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

function numericEntityCodePoint(body: string): number | null {
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const code = Number.parseInt(body.slice(2), 16);
    return Number.isFinite(code) ? code : null;
  }
  if (body.startsWith('#')) {
    const code = Number.parseInt(body.slice(1), 10);
    return Number.isFinite(code) ? code : null;
  }
  return null;
}

function safeFromCodePoint(code: number, fallback: string): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}
