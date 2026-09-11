// TAPD 2.0 rc.2 P3（需求 1139814312001001548）—— @昵称 ↔ at-who 标记双向语义（纯函数层）。
// 设计依据：FSD §3.5 / §8；e2e 金样 test/e2e-rc2/poc-rc2-mention.mjs（保真实证）。
//
// HTML 形态（逐字段定稿，属性顺序勿改——data-userid 存昵称而非数字 uid）：
//   <b class="at-who" contenteditable="false" data-userid="徐昭" data-type="user">@徐昭</b>
//
// md 形态：`@昵称`；转义语法：`@@` → 字面 `@`（不触发 mention）。
//
// 昵称文法（FSD §8 误伤对策：仅匹配「@ + 中文名/英文名 + 边界」）：
//   name-char   ::= Han 字符 | [A-Za-z0-9_]
//   mention     ::= left-boundary '@' name-char{1,}
//   left-boundary ::= 文本起始 | 非 name-char
//   名字 greedily 吃满 name-char，天然获得右边界（空白/标点/行尾）。
//   左边界要求 @ 前不能紧跟 name-char —— 邮箱 user@example.com、工单号 T-100@QA 因此不命中；
//   代价是中文紧贴写法（联系@徐昭）不生成 at-who，但 R4 实证服务端对纯文本 @昵称 仍智能识别，欠标记无害，
//   过标记（把邮箱拆成 at-who）才有害，故取保守侧。
//
// 分层约定（Wave 2 接线必读）：
//   - 本文件是纯函数语义层，零 IO、零 SDK 依赖，不感知 md 代码段/链接 URL 等 md 语法；
//     `@` 出现在代码段或 URL 内的场景必须在 markdown-it/turndown 的 token 级接线时规避
//     （本层提供的 fragment 级函数只做语义 token 替换，其余内容原样透传）。
//   - html→md 方向：at-who 一律还原为 `@昵称`，禁止降级为 `**粗体**`（R7 实测破坏点）。

import { decodeHtmlEntities, escapeHtmlAttr, escapeHtmlText } from './escape.js';

/** at-who 标记里命中的一次提及。`[start, end)` 覆盖含 `@` 在内的整个原始标记区间。 */
export interface Mention {
  name: string;
  start: number;
  end: number;
}

/**
 * 最小结构 DOM 节点视图（duck typing）——真实 turndown/DOM 节点天然满足，
 * 测试可直接传字面量对象，保持本库零 DOM 依赖。
 */
export interface HtmlNodeLike {
  nodeName: string;
  getAttribute(name: string): string | null;
  readonly textContent?: string | null;
}

const NAME_CHAR_RE = /[\p{Script=Han}A-Za-z0-9_]/u;

function isNameChar(ch: string | undefined): boolean {
  return ch !== undefined && NAME_CHAR_RE.test(ch);
}

/** 生成 at-who 标记（昵称含 HTML 特殊字符时按属性/文本位分别转义）。 */
export function renderMentionHtml(name: string): string {
  if (!name) throw new TypeError('mention name must be a non-empty string');
  return (
    `<b class="at-who" contenteditable="false" data-userid="${escapeHtmlAttr(name)}" data-type="user">` +
    `@${escapeHtmlText(name)}</b>`
  );
}

type AtToken =
  | { kind: 'escape'; start: number; end: number }
  | { kind: 'mention'; name: string; start: number; end: number };

/**
 * 单遍扫描文本中的 @ 语义 token：
 *   - `@@` 相邻对 → escape（md 侧表示一个字面 @）
 *   - 通过左边界 + 名字规则的 `@名字` → mention
 *   - 其余 `@` 不产出 token（由调用方原样处理）
 * 供 md→html 与 html→md 两个方向共用，保证双向规则严格镜像。
 */
function scanAtTokens(text: string): AtToken[] {
  const tokens: AtToken[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '@') {
      i += 1;
      continue;
    }
    if (text[i + 1] === '@') {
      tokens.push({ kind: 'escape', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (i > 0 && isNameChar(text[i - 1])) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < text.length && isNameChar(text[j])) j += 1;
    if (j > i + 1) tokens.push({ kind: 'mention', name: text.slice(i + 1, j), start: i, end: j });
    i = Math.max(j, i + 1);
  }
  return tokens;
}

/** 扫描文本中全部合法 mention（跳过 @@ 转义）。 */
export function findMentions(text: string): Mention[] {
  return scanAtTokens(text).flatMap((token) =>
    token.kind === 'mention' ? [{ name: token.name, start: token.start, end: token.end }] : [],
  );
}

/** md 文本片段中「疑似 html 标签」的区域：@ 语义跳过、原样透传（fragment 层不做 md 语法解析的边界）。 */
const TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

function replaceAtSemantics(segment: string): string {
  let out = '';
  let pos = 0;
  for (const token of scanAtTokens(segment)) {
    out += segment.slice(pos, token.start);
    out += token.kind === 'escape' ? '@' : renderMentionHtml(token.name);
    pos = token.end;
  }
  return out + segment.slice(pos);
}

/**
 * md 文本 → html 语义片段：`@@` → 字面 `@`，合法 `@昵称` → at-who 标记；
 * 其余内容（含疑似 html 标签区域）原样透传，交给基础转换器（markdown-it）完成。
 * 注意：本函数不做代码段/链接 URL 等 md 语法识别（见文件头分层约定）。
 */
export function mentionMdToHtml(md: string): string {
  let out = '';
  let pos = 0;
  TAG_RE.lastIndex = 0;
  for (;;) {
    const match = TAG_RE.exec(md);
    const segmentEnd = match ? match.index : md.length;
    out += replaceAtSemantics(md.slice(pos, segmentEnd));
    if (!match) break;
    out += match[0];
    pos = segmentEnd + match[0].length;
  }
  return out;
}

/**
 * html 文本 → md 文本：会把命中 mention 规则的字面 `@名字` 加倍为 `@@名字`、
 * `@@` 字面对加倍为 `@@@@`，使 md→html 重转换后语义不变（round-trip 稳定）；
 * 不命中规则的 `@`（如邮箱、工单号）原样保留，避免无谓转义噪音。
 * 与 md→html 的 scanAtTokens 共用同一套规则，双向严格镜像。
 */
export function escapeAtLiteralsForMd(text: string): string {
  let out = '';
  let pos = 0;
  for (const token of scanAtTokens(text)) {
    out += text.slice(pos, token.start);
    out += token.kind === 'escape' ? '@@@@' : `@@${token.name}`;
    pos = token.end;
  }
  return out + text.slice(pos);
}

const B_TAG_RE = /<b\b[^>]*>([\s\S]*?)<\/b\s*>|<\/?[a-zA-Z][^>]*>/gi;
const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const USERID_ATTR_RE = /\bdata-userid\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function classListOf(openTag: string): string[] {
  const match = CLASS_ATTR_RE.exec(openTag);
  if (!match) return [];
  return (match[1] ?? match[2] ?? '').split(/\s+/);
}

/** 判断一个标签串是否为 at-who 标记（`<b>` 且 class 含 at-who）。 */
export function isAtWhoTag(tagHtml: string): boolean {
  const openMatch = /^<b\b[^>]*>/i.exec(tagHtml);
  return openMatch !== null && classListOf(openMatch[0]).includes('at-who');
}

function nicknameFromTag(tagHtml: string, innerHtml: string | undefined): string {
  const useridMatch = USERID_ATTR_RE.exec(tagHtml);
  if (useridMatch) return decodeHtmlEntities(useridMatch[1] ?? useridMatch[2] ?? '');
  const text = decodeHtmlEntities((innerHtml ?? '').replace(/<[^>]+>/g, '')).trim();
  return text.startsWith('@') ? text.slice(1) : text;
}

/**
 * html 片段 → md 语义片段：
 *   - at-who 标记 → `@昵称`（data-userid 缺失时回退锚点内文本；禁止降级为 `**粗体**`）
 *   - 其余标签原样透传（非 at-who 的 `<b>` 不动，交给基础转换器 turndown 处理）
 *   - 标签之间的文本按 escapeAtLiteralsForMd 规则保护字面 @
 */
export function mentionHtmlToMd(html: string): string {
  let out = '';
  let pos = 0;
  let match: RegExpExecArray | null;
  B_TAG_RE.lastIndex = 0;
  while ((match = B_TAG_RE.exec(html)) !== null) {
    out += escapeAtLiteralsForMd(html.slice(pos, match.index));
    const isAtWho = isAtWhoTag(match[0]);
    const nickname = isAtWho ? nicknameFromTag(match[0], match[1]) : '';
    out += nickname ? `@${nickname}` : match[0];
    pos = match.index + match[0].length;
  }
  out += escapeAtLiteralsForMd(html.slice(pos));
  return out;
}

/** turndown 规则 filter 用：节点是否为 at-who 标记。 */
export function isAtWhoNode(node: HtmlNodeLike): boolean {
  if (node.nodeName.toUpperCase() !== 'B') return false;
  return (node.getAttribute('class') ?? '').split(/\s+/).includes('at-who');
}

/**
 * turndown 规则 replacement 用：at-who 节点 → `@昵称`。
 * data-userid 优先；缺失时回退节点文本（去首 @）。永不产出 `**`。
 */
export function atWhoNodeToMd(node: HtmlNodeLike): string {
  const userid = node.getAttribute('data-userid');
  if (userid) return `@${userid}`;
  const text = (node.textContent ?? '').trim();
  return text.startsWith('@') ? text : `@${text}`;
}
