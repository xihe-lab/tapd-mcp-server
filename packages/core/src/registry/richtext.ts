import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { SERVER_MD_TOOLS, WRITE_RICHTEXT_FIELDS_BY_TOOL } from './richtext-manifests.generated.js';

const markdownIt = new MarkdownIt({ html: false, breaks: true });

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndown.use(gfm);

const BLOCK_HTML_RE = /<(p|div|ul|ol|li|table|thead|tbody|tr|td|th|strong|em|h[1-6]|blockquote|pre|br|a|span|code|img|hr|s|del|u|font|b|i)\b[^>]*>/i;

// TAPD 实体响应的富文本字段统一命名为 description（story/bug/task/comment/wiki/iteration/...）
export const READ_RICHTEXT_FIELDS: ReadonlySet<string> = new Set(['description']);

export function isRichtextAutoEnabled(): boolean {
  return process.env.TAPD_RICHTEXT_AUTO !== '0';
}

export function looksLikeHtml(value: string): boolean {
  return BLOCK_HTML_RE.test(value);
}

// 写侧三层路由：服务端 md 透传 -> 启发式双模 -> 关闭时全原样
export function transformWriteArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  if (!isRichtextAutoEnabled()) return args;
  const fields = WRITE_RICHTEXT_FIELDS_BY_TOOL[toolName];
  if (!fields) return args;
  const out = { ...args };
  for (const field of fields) {
    const value = out[field];
    if (typeof value !== 'string' || value.trim() === '' || looksLikeHtml(value)) continue;
    if (SERVER_MD_TOOLS.includes(toolName)) {
      if (field === 'description') {
        if (out.markdown_description === undefined) out.markdown_description = value;
        delete out.description;
      }
      continue;
    }
    out[field] = markdownIt.render(value);
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
        out[key] = turndown.turndown(value);
      } else {
        out[key] = walk(value);
      }
    }
    return out;
  }
  return node;
}
