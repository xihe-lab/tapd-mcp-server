// pipeline 模板与运行期类型（S1 引擎本体，S2 pm 层复用）
// 设计依据：tapd-2.0.0-pm-layer-design.md §3、tapd-cli-upgrade-prd.md §6 F8

/** 模板报告渲染声明 */
export interface PipelineReport {
  /** 输出格式：markdown/text 按模板插值渲染；json 输出全量运行摘要 */
  format?: 'markdown' | 'text' | 'json';
  /** 报告正文模板，支持 ${vars.x} / ${steps.<id>.data...} 插值与 | length 等过滤器 */
  template?: string;
}

/** 单个步骤。uses 与 expr 二选一：uses 走 toolRegistry.exec，expr 为本地表达式计算（不触 API） */
export interface PipelineStep {
  id: string;
  /** 既有原子命令对应的工具名，如 tapd_get_stories（必走 registry.exec 通道） */
  uses?: string;
  /** 本地表达式步骤：在 { vars, steps } 上下文中求值，返回值存为步骤输出 */
  expr?: string;
  /** 工具参数，字符串值支持 ${...} 插值 */
  args?: Record<string, unknown>;
  /** 条件执行：表达式为假时跳过该步骤 */
  where?: string;
  /** 结果过滤：数组结果逐项过滤（上下文含 item/index/vars/today） */
  filter?: string;
  /** 显式依赖（会与 ${steps.<id>} 隐式引用合并） */
  depends_on?: string[];
}

export interface PipelineTemplate {
  name: string;
  title?: string;
  /** 模板写标记：任一步骤为写操作时必须为 true（validate 强制） */
  write?: boolean;
  /** pm 层域标记（可选元数据）：pipeline run/validate 原生接受，tapd pm 借此路由域分组 */
  domain?: string;
  /** 工具步骤取回数据后统一解包 TAPD 包裹形态（{Story:{...}} → {...,__entity:'Story'}），过滤/表达式按扁平字段书写 */
  unwrap?: boolean;
  /** 模板变量（可被 --input 注入覆盖） */
  vars?: Record<string, unknown>;
  steps: PipelineStep[];
  report?: PipelineReport;
}

/** 步骤运行结果 */
export interface StepOutcome {
  id: string;
  uses?: string;
  write: boolean;
  status: 'ok' | 'failed' | 'skipped' | 'pending';
  /** 跳过原因：dry-run / write-gate / where / upstream-failed */
  skipReason?: string;
  durationMs?: number;
  data?: unknown;
  error?: { code: string; message: string };
}

/** dry-run 预览行（写闸门与 --dry-run 共用） */
export interface PlanEntry {
  wave: number;
  id: string;
  uses?: string;
  expr?: string;
  write: boolean;
  args: Record<string, unknown>;
  where?: string;
  filter?: string;
  dependsOn: string[];
}

export interface RunSummary {
  ok: boolean;
  pipeline: string;
  dryRun: boolean;
  /** 写闸门拦截：含写步骤且未 --yes（退出码 2，走用法错误） */
  gateBlocked: boolean;
  preview?: PlanEntry[];
  steps: StepOutcome[];
  report?: string;
  durationMs: number;
}

/** 事件流 JSONL 单行（--events <file.jsonl>） */
export interface PipelineEvent {
  ts: string;
  event:
    | 'pipeline.start'
    | 'pipeline.dry-run'
    | 'pipeline.gate-blocked'
    | 'pipeline.end'
    | 'step.start'
    | 'step.end'
    | 'step.skip';
  pipeline: string;
  step?: string;
  uses?: string;
  write?: boolean;
  ok?: boolean;
  skipReason?: string;
  errorCode?: string;
  durationMs?: number;
}

export type PipelineErrorCode =
  | 'TEMPLATE_INVALID' // 模板解析/结构错误（yaml/json 语法、必填字段缺失）
  | 'UNKNOWN_COMMAND' // uses 指向不存在的工具
  | 'SCHEMA_MISMATCH' // 步骤参数不符 zod schema
  | 'WRITE_MARKER_MISSING' // 含写步骤但模板未声明 write: true
  | 'DEPENDENCY_CYCLE' // 步骤依赖成环
  | 'REF_UNKNOWN' // 引用了不存在的步骤/变量
  | 'EXPR_ERROR' // 表达式求值失败
  | 'WRITE_GATE' // 写闸门拦截
  | 'STEP_FAILED' // 步骤运行失败（API_ERROR/TIMEOUT/AUTH_MISSING/READ_ONLY_BLOCKED）
  | 'IO'; // 文件读写失败

/** pipeline 专属错误：command 层据此路由退出码（USAGE=2 / RUNTIME=1） */
export class PipelineError extends Error {
  constructor(
    public readonly code: PipelineErrorCode,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
  }

  get exitCode(): number {
    switch (this.code) {
      case 'TEMPLATE_INVALID':
      case 'UNKNOWN_COMMAND':
      case 'SCHEMA_MISMATCH':
      case 'WRITE_MARKER_MISSING':
      case 'DEPENDENCY_CYCLE':
      case 'REF_UNKNOWN':
      case 'WRITE_GATE':
        return 2; // 用法错误：修正模板或补 --yes 后重跑
      default:
        return 1; // 运行错误（STEP_FAILED/EXPR_ERROR/IO）
    }
  }

  /** 与 CliError.render 同前缀风格：error: <code>: <message>，details 逐行缩进 */
  render(): string {
    return [`error: ${this.code}: ${this.message}`, ...this.details.map(d => `  - ${d}`)].join('\n');
  }
}
