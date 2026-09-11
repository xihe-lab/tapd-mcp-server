// TAPD 2.0 rc.2 richtext 语义库公共出口（纯函数层，零 IO / 零 SDK 依赖）。
// FSD §3.5：保真转换库与工具接线分离——本目录只提供语义原语，md_to_html/html_to_md
// 工具集成、写工具 raw_html 旁路、文档属 Wave 2。
//
// Wave 2 接线指引（与现有转换器风格对齐）：
//   md→html（markdown-it 侧，text/inline token 级）：
//     - findMentions(text) + renderMentionHtml(name) —— @昵称 → at-who 标记（@@ 转义由 findMentions 语义内建）
//     - parseAttachmentAnchorMd(md) + attachmentAnchorHtml(ref) —— attach: 链接 → data 五件套锚点
//     - 或直接用 fragment 级 mdToHtmlFragment / 各模块 fragment 函数做参考实现
//   html→md（turndown 侧，规则注册）：
//     - at-who：<b> 规则，filter=isAtWhoNode、replacement=atWhoNodeToMd（永不产出 **粗体**）
//     - 附件锚点：<a> 规则，filter=isAttachmentAnchorNode、replacement=attachmentAnchorNodeToMd
//     - 文本节点 @ 字面量保护：escapeAtLiteralsForMd（turndown text escape 钩子内调用）
//   保真规则须先于 GFM 通用规则注册（FSD §8 规则优先级要求）。

export * from './escape.js';
export * from './mention.js';
export * from './attachment-anchor.js';

import { mentionMdToHtml, mentionHtmlToMd } from './mention.js';
import { attachmentMdToHtml, attachmentHtmlToMd } from './attachment-anchor.js';

/**
 * md 语义片段 → html 语义片段（round-trip 参考实现）：
 * 先替换附件引用（其 link-text 可能含 @），再做 @ 语义替换（at-who/@@ 转义），
 * 两步均对其余内容原样透传。注意 fragment 层不感知 md 代码段/链接 URL（见 mention.ts 分层约定）。
 */
export function mdToHtmlFragment(md: string): string {
  return mentionMdToHtml(attachmentMdToHtml(md));
}

/**
 * html 语义片段 → md 语义片段（round-trip 参考实现）：
 * 先还原 at-who 并保护字面 @（此时附件锚点仍是标签、不会被误转义），再把可识别附件锚点还原为 md 扩展语法。
 */
export function htmlToMdFragment(html: string): string {
  return attachmentHtmlToMd(mentionHtmlToMd(html));
}
