// TAPD 2.0 rc.2 P1/P3（需求 1139814312001001548）—— 附件引用 md 扩展 ↔ data 五件套锚点 HTML
// 双向语义（纯函数层）。设计依据：FSD §3.1（embed_md/embed_html）、R6 定稿模板；
// 实证：rc2-painpoints-research.md（评论 367/368/369 严格作用域）+ e2e 金样 poc-rc2-file-embed.mjs。
//
// md 扩展语法（BNF）：
//   attachment-md ::= "[📎 " link-text "](attach:" ws "/" id ")"
//   link-text     ::= ( md-escape | 非 "\" "]" 换行 字符 )*
//   md-escape     ::= "\" 任一非换行字符            （仅 \[ \] \\ 被 unescape 语义消费）
//   ws / id       ::= 1*( 排除空白、")(" 、"/" 的字符 )（实际为 TAPD 数字 ID）
//
// HTML 定稿最小模板（前端重建组件只读 data 五件套，inner spans 全可省——评论 369 实证完美渲染）：
//   <a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="text"
//      data-name="<文件名>" data-size="<字节数>" target="_blank" rel="noopener"
//      href="/<ws>/attachments/preview_attachments/<附件ID>/story_description_attachment"><文件名></a>
//
// 语义约定：
//   - data-file-type 由文件扩展名映射（fileTypeFor / FILE_TYPE_BY_EXTENSION，导出供 Wave 2 上传工具复用）。
//   - html→md 方向丢 size/slug/type 细节：md 形态是纯引用（by design，round-trip 允许该损）。
//   - 不认识的锚点（缺 data 五件套关键属性、裸 <a href> 等）原样保留，绝不猜测改写。
//   - 与 mention.ts 相同的分层约定：fragment 级函数只做语义 token 替换 + 其余原样透传，
//     Wave 2 在 markdown-it/turndown token 级接线（本文件提供节点级 duck-typing 辅助）。

import { decodeHtmlEntities, escapeHtmlAttr, escapeHtmlText } from './escape.js';
import type { HtmlNodeLike } from './mention.js';

/** TAPD 前端附件组件的 file-type 图标分类。 */
export type FileType = 'text' | 'image' | 'pdf' | 'other';

/** 扩展名 → file-type 映射表（键为小写扩展名；导出供 Wave 2 上传工具复用）。 */
export const FILE_TYPE_BY_EXTENSION: Readonly<Record<string, FileType>> = {
  txt: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  pdf: 'pdf',
};

/** 由文件名（任意大小写扩展名）映射 file-type；无扩展名或未收录 → other。 */
export function fileTypeFor(filename: string): FileType {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename.trim());
  if (!match) return 'other';
  return FILE_TYPE_BY_EXTENSION[match[1].toLowerCase()] ?? 'other';
}

export const ATTACH_SCHEME = 'attach:';
export const DEFAULT_ATTACHMENT_SLUG = 'story_description_attachment';

/** 附件引用。size/fileType 可省略：省略 fileType 时按 name 扩展名映射。 */
export interface AttachmentRef {
  workspaceId: string;
  id: string;
  name: string;
  size?: number;
  fileType?: FileType;
}

export interface AttachmentAnchorHtmlOptions {
  /** href 末段 slug（随实体类型变化的场景可覆盖；默认评论/需求描述通用值）。 */
  slug?: string;
  /** data-can-preview，默认 true（R6 五件套定稿值）。 */
  canPreview?: boolean;
}

function assertRefToken(value: string, field: string): void {
  if (!value) throw new TypeError(`attachment ${field} must be a non-empty string`);
  if (/[\s()/]/.test(value)) {
    throw new TypeError(`attachment ${field} must not contain whitespace, "/", "(" or ")": ${JSON.stringify(value)}`);
  }
}

function escapeMdLinkText(name: string): string {
  return name.replace(/[\\\][]/g, (ch) => `\\${ch}`);
}

function unescapeMdLinkText(text: string): string {
  return text.replace(/\\([\\\][])/g, '$1');
}

/**
 * 生成附件引用 md：`[📎 <文件名>](attach:<ws>/<id>)`。
 * 文件名中的 `[` `]` `\` 按 md 规则转义（parseAttachmentAnchorMd 可逆）。
 */
export function attachmentAnchorMd(ref: Pick<AttachmentRef, 'workspaceId' | 'id' | 'name'>): string {
  assertRefToken(ref.workspaceId, 'workspaceId');
  assertRefToken(ref.id, 'id');
  if (!ref.name) throw new TypeError('attachment name must be a non-empty string');
  return `[📎 ${escapeMdLinkText(ref.name)}](${ATTACH_SCHEME}${ref.workspaceId}/${ref.id})`;
}

// `\\.` 允许任意转义字符；其余字符排除 `\`、`]`、换行（`[` 无需排除但转义统一处理）。
const ATTACH_MD_PATTERN = '\\[📎 ((?:\\\\.|[^\\\\\\]\\n])*)\\]\\(attach:([^()\\s]+)/([^()\\s]+)\\)';
const ATTACH_MD_RE = new RegExp(ATTACH_MD_PATTERN, 'g');
const ATTACH_MD_RE_ONE = new RegExp(ATTACH_MD_PATTERN);

/**
 * 解析单个附件引用 md 片段（非附件链接 / scheme 不符 → null，调用方原样保留）。
 * 返回的 ref 不含 size/fileType（md 形态不承载，html 侧按文件名重新映射）。
 */
export function parseAttachmentAnchorMd(md: string): AttachmentRef | null {
  const match = ATTACH_MD_RE_ONE.exec(md);
  if (!match) return null;
  return {
    workspaceId: match[2],
    id: match[3],
    name: unescapeMdLinkText(match[1]),
  };
}

/** 生成 R6 定稿最小锚点（data 五件套 + 零 spans）。size 省略时不输出 data-size。 */
export function attachmentAnchorHtml(ref: AttachmentRef, options: AttachmentAnchorHtmlOptions = {}): string {
  assertRefToken(ref.workspaceId, 'workspaceId');
  assertRefToken(ref.id, 'id');
  if (!ref.name) throw new TypeError('attachment name must be a non-empty string');
  const slug = options.slug ?? DEFAULT_ATTACHMENT_SLUG;
  const canPreview = options.canPreview ?? true;
  const fileType = ref.fileType ?? fileTypeFor(ref.name);
  const attrs = [
    'data-is-tapd-attachment="true"',
    `data-can-preview="${canPreview}"`,
    `data-file-type="${fileType}"`,
    `data-name="${escapeHtmlAttr(ref.name)}"`,
  ];
  if (ref.size !== undefined) attrs.push(`data-size="${ref.size}"`);
  attrs.push(
    'target="_blank"',
    'rel="noopener"',
    `href="/${ref.workspaceId}/attachments/preview_attachments/${ref.id}/${slug}"`,
  );
  return `<a ${attrs.join(' ')}>${escapeHtmlText(ref.name)}</a>`;
}

const A_OPEN_RE = /<a\b[^>]*>/gi;
const FLAG_ATTR_RE = /\bdata-is-tapd-attachment\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const NAME_ATTR_RE = /\bdata-name\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const SIZE_ATTR_RE = /\bdata-size\s*=\s*(?:"(\d+)"|'(\d+)')/i;
const FILE_TYPE_ATTR_RE = /\bdata-file-type\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HREF_ATTR_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const PREVIEW_HREF_RE = /^\/([^/\s]+)\/attachments\/preview_attachments\/([^/\s]+)\/([^/\s]*)$/i;

const FILE_TYPES: ReadonlySet<string> = new Set(['text', 'image', 'pdf', 'other']);

function attrValue(match: RegExpExecArray | null): string | null {
  if (!match) return null;
  return decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '');
}

function refFromOpenTag(openTag: string): AttachmentRef | null {
  const flag = attrValue(FLAG_ATTR_RE.exec(openTag));
  if (flag?.toLowerCase() !== 'true') return null;
  const name = attrValue(NAME_ATTR_RE.exec(openTag));
  const href = attrValue(HREF_ATTR_RE.exec(openTag));
  if (!name || !href) return null;
  const hrefMatch = PREVIEW_HREF_RE.exec(href);
  if (!hrefMatch) return null;
  const ref: AttachmentRef = { workspaceId: hrefMatch[1], id: hrefMatch[2], name };
  const size = attrValue(SIZE_ATTR_RE.exec(openTag));
  if (size !== null) {
    const parsed = Number.parseInt(size, 10);
    if (Number.isFinite(parsed)) ref.size = parsed;
  }
  const fileType = attrValue(FILE_TYPE_ATTR_RE.exec(openTag));
  if (fileType !== null && FILE_TYPES.has(fileType)) ref.fileType = fileType as FileType;
  return ref;
}

/**
 * 解析单个锚点标签串。识别条件（缺一即 null，调用方原样保留该锚点）：
 * data-is-tapd-attachment="true" + data-name + href 形如
 * `/<ws>/attachments/preview_attachments/<id>/<slug>`。兼容完整编辑器模板（含 inner spans / type / class）。
 */
export function parseAttachmentAnchorHtml(anchorHtml: string): AttachmentRef | null {
  const openMatch = /^<a\b[^>]*>/i.exec(anchorHtml);
  return openMatch ? refFromOpenTag(openMatch[0]) : null;
}

/** 扫描 html 片段中全部可识别的附件锚点。 */
export function findAttachmentAnchors(html: string): AttachmentRef[] {
  const refs: AttachmentRef[] = [];
  A_OPEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = A_OPEN_RE.exec(html)) !== null) {
    const ref = refFromOpenTag(match[0]);
    if (ref) refs.push(ref);
  }
  return refs;
}

const A_TAG_RE = /<a\b[^>]*>[\s\S]*?<\/a\s*>|<a\b[^>]*\/?>/gi;

/**
 * html 片段 → md 语义片段：可识别锚点 → `[📎 name](attach:ws/id)`；
 * 不认识的锚点与其余内容原样透传（交给基础转换器 turndown 处理）。
 */
export function attachmentHtmlToMd(html: string): string {
  let out = '';
  let pos = 0;
  let match: RegExpExecArray | null;
  A_TAG_RE.lastIndex = 0;
  while ((match = A_TAG_RE.exec(html)) !== null) {
    const openMatch = /^<a\b[^>]*>/i.exec(match[0]);
    const ref = openMatch ? refFromOpenTag(openMatch[0]) : null;
    out += html.slice(pos, match.index);
    out += ref ? attachmentAnchorMd(ref) : match[0];
    pos = match.index + match[0].length;
  }
  return out + html.slice(pos);
}

/**
 * md 片段 → html 语义片段：附件引用 → R6 锚点；
 * 非 `attach:` scheme 的链接与其余内容原样透传（交给基础转换器 markdown-it 处理）。
 */
export function attachmentMdToHtml(md: string): string {
  let out = '';
  let pos = 0;
  let match: RegExpExecArray | null;
  ATTACH_MD_RE.lastIndex = 0;
  while ((match = ATTACH_MD_RE.exec(md)) !== null) {
    out += md.slice(pos, match.index);
    out += attachmentAnchorHtml({ workspaceId: match[2], id: match[3], name: unescapeMdLinkText(match[1]) });
    pos = match.index + match[0].length;
  }
  return out + md.slice(pos);
}

/** turndown 规则 filter 用：节点是否为可识别附件锚点。 */
export function isAttachmentAnchorNode(node: HtmlNodeLike): boolean {
  if (node.nodeName.toUpperCase() !== 'A') return false;
  return (node.getAttribute('data-is-tapd-attachment') ?? '').toLowerCase() === 'true';
}

/** turndown 规则 replacement 用：锚点节点 → 附件引用 md；不满足识别条件返回 null（调用方保留原样）。 */
export function attachmentAnchorNodeToMd(node: HtmlNodeLike): string | null {
  if (!isAttachmentAnchorNode(node)) return null;
  const name = node.getAttribute('data-name');
  const href = node.getAttribute('href');
  if (!name || !href) return null;
  const hrefMatch = PREVIEW_HREF_RE.exec(decodeHtmlEntities(href));
  if (!hrefMatch) return null;
  const ref: AttachmentRef = { workspaceId: hrefMatch[1], id: hrefMatch[2], name: decodeHtmlEntities(name) };
  const size = node.getAttribute('data-size');
  const parsedSize = size === null ? Number.NaN : Number.parseInt(size, 10);
  if (Number.isFinite(parsedSize)) ref.size = parsedSize;
  const fileType = node.getAttribute('data-file-type');
  if (fileType !== null && FILE_TYPES.has(fileType)) ref.fileType = fileType as FileType;
  return attachmentAnchorMd(ref);
}
