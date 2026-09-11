import { z } from 'zod';
import { DUAL_WRITE_TOOLS, WRITE_RICHTEXT_FIELDS_BY_TOOL } from './richtext-manifests.generated.js';
// rc.2 P3 接线（1139814312001001548）：写/读管道与 md_to_html/html_to_md 工具共用同一条
// 保真转换管道（richtext/pipeline.ts，token/规则级 @ + 附件锚点接线）——FSD §3.7。
import { htmlToMd, mdToHtml } from '../richtext/pipeline.js';

const BLOCK_HTML_RE = /<(p|div|ul|ol|li|table|thead|tbody|tr|td|th|strong|em|h[1-6]|blockquote|pre|br|a|span|code|img|hr|s|del|u|font|b|i)\b[^>]*>/i;

/**
 * raw_html 直发通道（P3，FSD §3.5，需求 1139814312001001548）。
 * 富文本写工具（comment/story/task/bug/wiki 的 create/update）共享的 schema 字段：
 * true 时 description 原样透传（绕过 md→html 自动转换，R7 服务端保真），适用于已含
 * TAPD 附件锚点 / at-who 标记的富文本或需要确定性透传的场景。默认 false 走 md 管道。
 * 参数在 transformWriteArgs 内消费并摘除，不会透传给 TAPD API。
 */
export const RAW_HTML_FIELD = z.boolean().optional().default(false).describe(
  'raw HTML 直发通道：true 时 description 原样透传（绕过 md→html 自动转换，服务端保真），适用于已含 TAPD 附件锚点/at-who 标记的富文本；默认 false 走 md 管道（@昵称/附件引用自动转换）'
);

// TAPD 实体响应的富文本字段统一命名为 description（story/bug/task/comment/wiki/iteration/...）
export const READ_RICHTEXT_FIELDS: ReadonlySet<string> = new Set(['description']);

export function isRichtextAutoEnabled(): boolean {
  return process.env.TAPD_RICHTEXT_AUTO !== '0';
}

export function looksLikeHtml(value: string): boolean {
  return BLOCK_HTML_RE.test(value);
}

// 写侧三层路由：raw_html 旁路 -> wiki 双写 -> 启发式双模 -> 关闭时全原样
export function transformWriteArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const out = { ...args };
  // raw_html 旁路（P3，R7 服务端保真）：先摘除，避免作为未知参数透传给 TAPD API
  const rawHtml = out.raw_html === true;
  delete out.raw_html;
  if (!isRichtextAutoEnabled()) return out;
  const fields = WRITE_RICHTEXT_FIELDS_BY_TOOL[toolName];
  if (!fields) return out;
  for (const field of fields) {
    const value = out[field];
    if (typeof value !== 'string' || value.trim() === '' || looksLikeHtml(value)) continue;
    // raw_html: true → description 原样透传，绕过 md→html（含 at-who/附件锚点转换）；
    // markdown_description 维持既有双写策略：永不自动改写（raw_html 时也无 md 源可回填，不自动补 markdown_description）
    if (rawHtml) continue;
    if (DUAL_WRITE_TOOLS.includes(toolName)) {
      if (field === 'description') {
        if (out.markdown_description === undefined) out.markdown_description = value;
        out[field] = mdToHtml(value);
      }
      continue;
    }
    out[field] = mdToHtml(value);
  }
  return out;
}

// 读侧：递归扫描富文本字段，HTML 转 md；无标签特征的值原样
export function transformReadData(data: unknown): unknown {
  if (!isRichtextAutoEnabled()) return data;
  return walk(data);
}

function walk(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walk);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (READ_RICHTEXT_FIELDS.has(key) && typeof value === 'string' && looksLikeHtml(value)) {
        out[key] = htmlToMd(value);
      } else {
        out[key] = walk(value);
      }
    }
    // 存量 wiki：description 空、md 原文在 markdown_description，回填保正文闭环
    const legacyMd = out.markdown_description;
    if (!out.description && typeof legacyMd === 'string' && legacyMd.trim() !== '') {
      out.description = legacyMd;
    }
    return out;
  }
  return node;
}
