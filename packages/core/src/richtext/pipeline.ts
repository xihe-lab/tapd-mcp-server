// TAPD 2.0 rc.2 P3 接线（需求 1139814312001001548）—— 富文本保真转换主管道。
//
// B 侧语义库（core/richtext，纯函数）在转换器「token / 规则级」接入（B 的接线警告）：
//   - md→html（markdown-it core 规则，token 级）：
//       * `attach:` 链接（link_open..link_close 纯文本运行）→ 整段替换为 R6 data 五件套锚点
//         （html_inline token；html:false 只影响解析不影响程序化 token 的渲染）；
//       * `@昵称` / `@@` 语义只在 inline children 的 **text token** 内替换（mention/escape 各自成 token）；
//       * code_inline / fence / html_* / image（含 alt）/ 链接内部（含 URL）一律跳过；
//         裸 URL（https://.../@name）内的 @ 由「连续非空白段含 ://」护栏跳过。
//       * 禁止对整段输入直接调 fragment 级函数上线（会误伤代码段与 URL）——本模块即正确接线层。
//   - html→md（turndown 规则级）：
//       * at-who <b> → `@昵称`（永不降级 **粗体**，R7）；附件锚点 <a> → `[📎 name](attach:ws/id)`；
//         识别失败（href 缺失等）保留原节点 HTML，绝不猜测改写。
//       * 保真规则先于 GFM 注册（FSD §8）：turndown addRule 为 unshift 语义（后注册者先匹配），
//         故在 use(gfm) 之后再 addRule 即获得最高匹配优先级，并有规则优先级测试固化。
//       * 文本节点字面 @ 保护走 turndown 实例 escape 钩子（escapeAtLiteralsForMd；
//         CODE 内文本 isCode 天然绕过 escape，代码段 @ 不被加倍）。
//
// 单一实例共享给 md_to_html/html_to_md 工具（tools/utility.ts）与写管道
// （registry/richtext.ts 的 transformWriteArgs/transformReadData）——FSD §3.7：
// 所有富文本写工具与 pm 层场景共用同一条管道，免费获得 @/附件/图片能力。

import MarkdownIt from 'markdown-it';
import type { StateCore, Token } from 'markdown-it';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import {
  attachmentAnchorHtml,
  attachmentAnchorNodeToMd,
  atWhoNodeToMd,
  escapeAtLiteralsForMd,
  findMentions,
  isAttachmentAnchorNode,
  isAtWhoNode,
  renderMentionHtml,
} from './index.js';

// ---------------------------------------------------------------------------
// md → html（markdown-it，token 级）
// ---------------------------------------------------------------------------

/** `attach:<ws>/<id>`（与 richtext md 扩展语法的 ws/id 文法一致：排除空白、()、/）。 */
const ATTACH_HREF_RE = /^attach:([^()\s/]+)\/([^()\s/]+)$/i;

/**
 * 裸 URL 防误伤：mention 候选往前回溯同一连续非空白段，段内含 `://` 视为 URL 的一部分
 * （如 `https://e.com/@zhang`）。md 链接语法 `[t](url)` 的 URL 在 token attrs 里天然不进本层。
 */
function insideBareUrl(content: string, atIndex: number): boolean {
  let start = atIndex;
  while (start > 0 && !/\s/.test(content[start - 1])) start -= 1;
  return content.slice(start, atIndex).includes('://');
}

type TokenCtor = typeof Token;

/**
 * 把一个 text token 的内容按 @ 语义拆分为 [text | html_inline] 串
 * （镜像 richtext scanAtTokens 规则：@@ 优先、findMentions 已内建左边界判定）。
 * 无任何语义变化时返回 null（调用方保留原 token，避免无谓重排）。
 */
function splitTextTokenAtSemantics(TokenCtor: TokenCtor, token: Token): Token[] | null {
  const content = token.content;
  const mentions = findMentions(content);
  if (mentions.length === 0 && !content.includes('@@')) return null;
  const mentionByStart = new Map(mentions.map(m => [m.start, m]));

  const out: Token[] = [];
  let plain = '';
  const flush = (): void => {
    if (plain === '') return;
    const text = new TokenCtor('text', '', 0);
    text.content = plain;
    out.push(text);
    plain = '';
  };

  let i = 0;
  let changed = false;
  while (i < content.length) {
    if (content[i] === '@') {
      if (content[i + 1] === '@') {
        plain += '@'; // md 转义 @@ → 字面 @
        changed = true;
        i += 2;
        continue;
      }
      const mention = mentionByStart.get(i);
      if (mention && !insideBareUrl(content, i)) {
        flush();
        const html = new TokenCtor('html_inline', '', 0);
        html.content = renderMentionHtml(mention.name);
        out.push(html);
        changed = true;
        i = mention.end;
        continue;
      }
    }
    plain += content[i];
    i += 1;
  }
  flush();
  if (!changed || (out.length === 1 && out[0].type === 'text' && out[0].content === content)) return null;
  return out;
}

/** inline children 内的 `attach:` 链接 → R6 锚点（整段替换为单个 html_inline token）。 */
function convertAttachmentLinks(TokenCtor: TokenCtor, tokens: Token[]): void {
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== 'link_open') continue;
    const href = String(open.attrGet('href') ?? '');
    const refMatch = ATTACH_HREF_RE.exec(href.trim());
    if (!refMatch) continue;

    // link_open..link_close 之间必须是纯文本运行（含嵌套/换行则保守跳过，保留原链接）
    let text = '';
    let closeIdx = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === 'link_close') {
        closeIdx = j;
        break;
      }
      if (t.type !== 'text') break;
      text += t.content;
    }
    if (closeIdx < 0) continue;

    const name = text.replace(/^\s*📎\s*/, '');
    if (name === '') continue;
    let anchor: string;
    try {
      anchor = attachmentAnchorHtml({ workspaceId: refMatch[1], id: refMatch[2], name });
    } catch {
      continue; // ws/id 含空白或非法字符 → 原样保留（绝不猜测改写）
    }
    const htmlToken = new TokenCtor('html_inline', '', 0);
    htmlToken.content = anchor;
    tokens.splice(i, closeIdx - i + 1, htmlToken);
  }
}

/** inline children 内 text token 的 @ 语义替换（链接内部跳过；code/html/image token 天然跳过）。 */
function convertMentions(TokenCtor: TokenCtor, tokens: Token[]): void {
  let linkDepth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'link_open') {
      linkDepth += 1;
      continue;
    }
    if (token.type === 'link_close') {
      linkDepth = Math.max(0, linkDepth - 1);
      continue;
    }
    if (linkDepth > 0) continue; // 链接文本内 @ 不转换（URL 已天然不在 text token）
    if (token.type !== 'text') continue;
    const replacement = splitTextTokenAtSemantics(TokenCtor, token);
    if (replacement) {
      tokens.splice(i, 1, ...replacement);
      i += replacement.length - 1;
    }
  }
}

function tapdRichtextCoreRule(state: StateCore): void {
  const TokenCtor = state.Token;
  for (const token of state.tokens) {
    // fence/code_block/html_block 等 block token 内容不经过 inline 层，天然跳过
    if (token.type !== 'inline' || !token.children) continue;
    convertAttachmentLinks(TokenCtor, token.children);
    convertMentions(TokenCtor, token.children);
  }
}

const markdownIt = new MarkdownIt({ html: false, breaks: true });
// push 到 core 链尾（text_join 之后）：不再有规则会合并/重排我们的 token 切分
markdownIt.core.ruler.push('tapd_richtext_semantics', tapdRichtextCoreRule);

/** md → TAPD 富文本 html（@昵称/@@转义/attach: 附件引用/图片与普通 md 全兼容）。 */
export function mdToHtml(md: string): string {
  return markdownIt.render(md);
}

// ---------------------------------------------------------------------------
// html → md（turndown，规则级）
// ---------------------------------------------------------------------------

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndown.use(gfm);

// 保真规则先于 GFM/内建规则匹配：addRule 是 unshift 语义（后注册者先匹配），
// 在 use(gfm) 之后注册即拿到最高优先级（FSD §8，规则优先级由测试固化）。
turndown.addRule('tapdAtWho', {
  filter: node => isAtWhoNode(node),
  replacement: (_content, node) => atWhoNodeToMd(node),
});
turndown.addRule('tapdAttachmentAnchor', {
  filter: node => isAttachmentAnchorNode(node),
  replacement: (_content, node) => {
    const md = attachmentAnchorNodeToMd(node);
    // 识别条件不满足（缺 href 等）→ 保留原节点 HTML，绝不猜测改写
    return md ?? (node as unknown as { outerHTML?: string }).outerHTML ?? '';
  },
});

// 文本节点字面 @ 保护（round-trip 稳定：命中 mention 规则的 @名字 加倍为 @@名字）。
// CODE 内文本 isCode 天然绕过 escape 钩子（turndown process 分支），代码段 @ 不被加倍。
const baseEscape = TurndownService.prototype.escape.bind(
  TurndownService.prototype,
);
turndown.escape = (text: string) => baseEscape(escapeAtLiteralsForMd(text));

/** TAPD 富文本 html → md（at-who → @昵称、附件锚点 → attach: 引用、/tfl/ 图片走 GFM 内建规则）。 */
export function htmlToMd(html: string): string {
  return turndown.turndown(html);
}
