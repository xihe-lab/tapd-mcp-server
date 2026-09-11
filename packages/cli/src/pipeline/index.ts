// pipeline 引擎公共出口（S2 pm 层从这里取接口）
export type {
  PipelineTemplate,
  PipelineStep,
  PipelineReport,
  PlanEntry,
  RunSummary,
  StepOutcome,
  PipelineEvent,
  PipelineErrorCode,
} from './types.js';
export { PipelineError } from './types.js';
export { parseTemplate, loadTemplate, resolveTemplatePath, listBuiltinTemplates, builtinTemplatesDir } from './template.js';
export { validateTemplate, assertTemplateValid, formatIssues } from './validate.js';
export type { ValidationIssue, ValidationResult } from './validate.js';
export { planWaves, buildPreview, renderPreview, runPipeline } from './engine.js';
export type { RunOptions } from './engine.js';
export { interpolate, interpolateForPreview, evalRef, evalWhere, evalFilter, evalExprStep, extractStepRefs, isDeferredStepRef } from './expression.js';
export type { ExprContext } from './expression.js';
export { historyPath, recordCommandHistory, readHistory, historyEnabled } from './history.js';
export { buildTemplateFromHistory, renderTemplateYaml } from './record.js';
