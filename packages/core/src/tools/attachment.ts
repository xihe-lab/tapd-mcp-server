import { createReadStream, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import type { ToolDef } from '../types.js';
import { TapdClient } from '../tapd-client.js';

// ---------------------------------------------------------------------------
// Shared file/anchor helpers (reused by tools/media.ts and Wave 2 richtext lib)
// ---------------------------------------------------------------------------

/** TAPD upload limit — mirrors the SDK axios maxBodyLength (300MB). */
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
/** FSD §6: files above 50MB get a size warning in the tool result. */
export const LARGE_FILE_WARN_BYTES = 50 * 1024 * 1024;

export interface LocalFile {
  absolutePath: string;
  size: number;
}

function expandTilde(p: string): string {
  if (p === '~') return os.homedir();
  if (p === '~/' || p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/**
 * Resolve a user-supplied local file path to an absolute path and verify it is
 * an existing regular file within the 300MB upload limit.
 * - `~` expansion is a defense for direct (MCP) callers; the CLI flags layer
 *   normalizes paths before invoking core (FSD §2).
 * - Throws a descriptive Error for ENOENT / directory / oversize.
 */
export function resolveLocalFile(fileArg: string): LocalFile {
  const absolutePath = path.resolve(expandTilde(fileArg));
  if (!existsSync(absolutePath)) {
    throw new Error(`file not found: ${fileArg} (resolved: ${absolutePath})`);
  }
  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`not a regular file: ${absolutePath}`);
  }
  if (stat.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `file too large: ${fileArg} is ${(stat.size / 1024 / 1024).toFixed(1)}MB, TAPD upload limit is 300MB`
    );
  }
  return { absolutePath, size: stat.size };
}

/**
 * Zod refine helper: turn a missing/oversized local file into an INVALID_ARGS
 * schema error (CLI maps INVALID_ARGS to usage exit 2 per FSD §3.1) instead of
 * a runtime API error. The file is re-validated in the handler for direct
 * callers that bypass registry parsing.
 */
export function localFileRefine(): (v: string) => boolean {
  return (v: string) => {
    try {
      resolveLocalFile(v);
      return true;
    } catch {
      return false;
    }
  };
}

/** Strip path separators / control chars — an uploaded filename is a label, never a path. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base.replace(/[\r\n\t\0]/g, ' ').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : 'attachment';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * TAPD front-end file-type vocabulary. Only the plain-text family is
 * evidenced end-to-end (research R6: data-file-type="text" renders perfectly);
 * unknown extensions pass through as-is and the front-end picks its fallback
 * icon while still showing name/size from the data attributes.
 */
const TEXT_LIKE_EXTENSIONS = new Set(['txt', 'text', 'log', 'md', 'csv', 'json', 'xml', 'yml', 'yaml']);

export interface AttachmentAnchorInput {
  workspace_id: string | number;
  id: string | number;
  /** Display name (data-name + anchor text). */
  filename: string;
  /** File size in bytes (data-size — the front-end formats it). */
  size: number;
  /** TAPD preview/file-type hint; defaults from the filename extension. */
  file_type?: string;
}

/**
 * Build the R6 data五件套 attachment anchor for TAPD rich-text fields
 * (comments / description). Verified minimal template (research comment 369):
 * the front-end rebuilds its attachment component purely from the data
 * attributes, so inner spans can be omitted.
 *
 * Exported for the Wave 2 richtext conversion library
 * (`[📎 name](attach:<ws>/<id>)` → anchor), not a tool itself (FSD §2 ruling 2).
 */
export function buildAttachmentAnchor(input: AttachmentAnchorInput): string {
  const dot = input.filename.lastIndexOf('.');
  const ext = dot > -1 && dot < input.filename.length - 1 ? input.filename.slice(dot + 1).toLowerCase() : '';
  const fileType = input.file_type ?? (TEXT_LIKE_EXTENSIONS.has(ext) ? 'text' : ext || 'other');
  const name = escapeHtml(input.filename);
  const size = Math.max(0, Math.round(input.size));
  return (
    `<a data-is-tapd-attachment="true" data-can-preview="true" data-file-type="${escapeHtml(fileType)}"` +
    ` data-name="${name}" data-size="${size}" target="_blank" rel="noopener"` +
    ` href="/${input.workspace_id}/attachments/preview_attachments/${input.id}/story_description_attachment">${name}</a>`
  );
}

/** `[📎 <name>](attach:<ws>/<id>)` — md 管道场景的附件引用（P3 语法接线用）。 */
export function buildAttachmentMarkdown(workspaceId: string | number, id: string | number, filename: string): string {
  return `[📎 ${filename}](attach:${workspaceId}/${id})`;
}

function optionalSizeWarning(size: number): { warning?: string } {
  return size > LARGE_FILE_WARN_BYTES
    ? { warning: `file is ${(size / 1024 / 1024).toFixed(1)}MB (>50MB), upload/download may be slow` }
    : {};
}

function requireWorkspaceId(params: { workspace_id?: number }): number {
  const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
  if (!workspaceId) {
    throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
  }
  return workspaceId;
}

export const attachmentTools: ToolDef[] = [
  // Standard TAPD API attachment tools
  {
    name: 'tapd_get_attachments',
    description: 'Get attachment list from TAPD',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Attachment ID, supports multiple IDs；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_id: z.string().optional().describe('Related entity ID (story/task/bug/wiki ID)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entity_type: z.string().optional().describe('Entity type (story, task, bug, wiki)'),
      filename: z.string().optional().describe('Filename'),
      owner: z.string().optional().describe('Uploader'),
      created: z.string().optional().describe('Creation time, supports time query'),
      modified: z.string().optional().describe('Last modification time, supports time query'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
      limit: z.number().optional().describe('Number of results to return, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
      order: z.string().optional().describe('Sort order, e.g., "created desc"'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_attachment',
    description: 'Get a single attachment from TAPD',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      fields: z.string().optional().describe('Comma-separated list of fields to return'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments/get_one', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_get_attachment_download_url',
    description: 'Get download URL for a single attachment (valid for 300s)。注意：推荐改用 tapd_download_attachment（走 /attachments/down 端点，无需额外权限；本工具的 documents_down 端点需要 attachments::documents_down 授权）。',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      filename: z.string().optional().describe('Filename for download'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments/documents_down', { ...params, workspace_id: workspaceId });
    },
  },
  // ---------------------------------------------------------------------
  // rc.2 rich-media collaboration tools (FSD §3.1-3.3, requirement 1139814312001001546)
  // ---------------------------------------------------------------------
  {
    name: 'tapd_upload_attachment',
    description: '上传本地文件为 TAPD 附件并绑定到实体（需求/缺陷/任务，一次调用完成上传+绑定）。返回附件元数据、embed_html（R6 data 五件套锚点，可原样拼入评论/描述富文本）与 embed_md（[📎 文件名](attach:<ws>/<id>)）。附件随后可通过 tapd_download_attachment 下载。文件上限 300MB。',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      file_path: z.string().min(1).refine(localFileRefine(), { message: '本地文件不存在（或超过 300MB 上限）' }).describe('本地文件路径（绝对路径，或相对当前工作目录）'),
      entity_type: z.enum(['story', 'bug', 'task']).describe('绑定实体类型；entity_id 必须是该类型实体的真实 ID（严格同体型，不做跨表侥幸绑定）'),
      entity_id: z.string().describe('目标实体长 ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      filename: z.string().optional().describe('上传后显示的文件名，缺省取 file_path 的 basename'),
    }),
    handler: async (client, params) => {
      const workspaceId = requireWorkspaceId(params);
      const { absolutePath, size } = resolveLocalFile(params.file_path);
      const filename = sanitizeFilename(params.filename ?? path.basename(absolutePath));
      const data = await client.postFile<{ Attachment?: Record<string, unknown> }>('/files/upload_attachment', {
        workspace_id: workspaceId,
        filename,
        type: params.entity_type,
        entry_id: params.entity_id,
        file: createReadStream(absolutePath),
      });
      const attachment = (data?.Attachment ?? data ?? {}) as Record<string, unknown>;
      const id = typeof attachment.id === 'string' || typeof attachment.id === 'number'
        ? String(attachment.id)
        : '';
      if (id === '') {
        throw new Error(`unexpected uploadAttachment response (no Attachment.id): ${JSON.stringify(data).slice(0, 200)}`);
      }
      const finalName = typeof attachment.filename === 'string' && attachment.filename !== ''
        ? attachment.filename
        : filename;
      const finalSize = Number(attachment.size ?? size) || size;
      return {
        ...attachment,
        embed_html: buildAttachmentAnchor({ workspace_id: workspaceId, id, filename: finalName, size: finalSize }),
        embed_md: buildAttachmentMarkdown(workspaceId, id, finalName),
        ...optionalSizeWarning(size),
      };
    },
    cli: { resource: 'attachment', action: 'upload', positional: 'file_path' },
  },
  {
    name: 'tapd_download_attachment',
    description: '下载 TAPD 附件：走 /attachments/down（attachment#r，无需额外授权）拿到 file.tapd.cn 签名 URL（300s 有效）。不带 out_path 时仅返回 {download_url, filename, content_type} 供自行 fetch；带 out_path（必须位于当前工作目录内）时直接落盘并返回 {saved_to, bytes, sha1}。',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      out_path: z.string().optional().describe('保存路径（已存在的目录则取附件名落盘；否则视为完整文件路径）。必须在当前工作目录内。省略时仅返回下载元数据'),
    }),
    handler: async (client, params) => {
      const workspaceId = requireWorkspaceId(params);
      const data = await client.get<Record<string, unknown>>('/attachments/down', {
        workspace_id: workspaceId,
        id: params.id,
      });
      const attachment = ((data?.Attachment ?? data) ?? {}) as Record<string, unknown>;
      const downloadUrl = typeof attachment.download_url === 'string' ? attachment.download_url : undefined;
      if (!downloadUrl) {
        throw new Error(`no download_url returned for attachment ${params.id}: ${JSON.stringify(data).slice(0, 200)}`);
      }
      const filename = typeof attachment.filename === 'string' && attachment.filename !== ''
        ? attachment.filename
        : `attachment-${params.id}`;
      const meta = {
        id: params.id,
        filename,
        download_url: downloadUrl,
        ...(typeof attachment.content_type === 'string' ? { content_type: attachment.content_type } : {}),
      };
      if (!params.out_path) {
        return meta;
      }

      // Path traversal guard: the resolved target must stay inside process.cwd().
      const cwd = process.cwd();
      const resolvedOut = path.resolve(expandTilde(params.out_path));
      if (resolvedOut !== cwd && !resolvedOut.startsWith(cwd + path.sep)) {
        throw new Error(`out_path must stay within the working directory (${cwd}): ${params.out_path}`);
      }
      const stat = existsSync(resolvedOut) ? statSync(resolvedOut) : undefined;
      const target = stat?.isDirectory() ? path.join(resolvedOut, sanitizeFilename(filename)) : resolvedOut;

      // The signature URL points at file.tapd.cn — plain GET, no TAPD API auth.
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`failed to download attachment bytes: HTTP ${response.status} ${response.statusText}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(target, bytes);
      const sha1 = createHash('sha1').update(bytes).digest('hex');
      return {
        ...meta,
        saved_to: target,
        bytes: bytes.length,
        sha1,
        ...optionalSizeWarning(bytes.length),
      };
    },
    cli: { resource: 'attachment', action: 'download', positional: 'id' },
  },
  {
    name: 'tapd_attach_external_file',
    description: '将第三方系统文件挂接到 TAPD 实体（不传输文件本体，仅登记标题+链接，FSD §3.3）。type 目前服务端仅支持 png/psd。',
    write: true,
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      title: z.string().min(1).describe('第三方附件标题'),
      source_url: z.string().min(1).describe('第三方附件链接'),
      entity_type: z.enum(['story', 'bug', 'task']).describe('挂接实体类型（story/bug/task）'),
      entity_id: z.string().describe('目标实体长 ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      type: z.enum(['png', 'psd']).default('png').describe('附件类型，目前服务端只支持 png/psd'),
      creator: z.string().optional().describe('创建人，缺省为当前授权用户'),
    }),
    handler: async (client, params) => {
      const workspaceId = requireWorkspaceId(params);
      return client.post('/open_app_obj_attachment', {
        workspace_id: workspaceId,
        title: params.title,
        type: params.type ?? 'png',
        entry_type: params.entity_type,
        entry_id: params.entity_id,
        source_url: params.source_url,
        ...(params.creator !== undefined ? { creator: params.creator } : {}),
      });
    },
    cli: { resource: 'attachment', action: 'attach-external' },
  },
  // Mini (轻协作) API attachment tools
  {
    name: 'tapd_mini_get_attachments',
    description: 'Get attachments from mini workspace',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().optional().describe('Attachment ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      entry_id: z.string().optional().describe('Item ID；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
      filename: z.string().optional().describe('Filename'),
      owner: z.string().optional().describe('Uploader'),
      limit: z.number().optional().describe('Return count, default 30, max 200'),
      page: z.number().optional().describe('Page number, default 1'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments', { ...params, workspace_id: workspaceId });
    },
  },
  {
    name: 'tapd_mini_get_attachment_download_url',
    description: 'Get download URL for a single mini workspace attachment (valid for 300s)',
    inputSchema: z.object({
      workspace_id: z.number().optional().describe('项目ID（可省略，使用默认配置）'),
      id: z.string().describe('Attachment ID (required)；必须以字符串（带引号）传递，禁止传数值，20 位 ID 超出 JS 安全整数范围会丢精度'),
    }),
    handler: async (client, params) => {
      const workspaceId = params.workspace_id ?? TapdClient.getDefaultWorkspaceId();
      if (!workspaceId) {
        throw new Error('workspace_id is required (either provide it or set TAPD_DEFAULT_WORKSPACE_ID env)');
      }
      return client.get('/attachments/down', { ...params, workspace_id: workspaceId });
    },
  },
];