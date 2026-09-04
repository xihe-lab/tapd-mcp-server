import { z } from 'zod';

const LONG_ID_PARAM = /^(id|ids)$|^([a-z_]+_ids?)$/;

function wrapLongIdField(field: z.ZodTypeAny, key: string): z.ZodTypeAny | null {
  const wrap = (inner: z.ZodString) =>
    z.preprocess(v => {
      if (typeof v !== 'number') return v;
      if (Number.isSafeInteger(v)) return String(v);
      throw new Error(`参数 ${key} 的值超出 JS 安全整数范围（精度丢失），请以字符串（带引号）重传`);
    }, inner);

  if (field instanceof z.ZodString) {
    const core = wrap(field);
    return field.description ? core.describe(field.description) : core;
  }
  if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
    const inner = field._def.innerType;
    if (!(inner instanceof z.ZodString)) return null;
    const core = wrap(inner);
    const rebuilt = field instanceof z.ZodOptional ? core.optional() : core.nullable();
    return field.description ? rebuilt.describe(field.description) : rebuilt;
  }
  return null;
}

export function guardLongIdSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (!(schema instanceof z.ZodObject)) return schema;
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const next: Record<string, z.ZodTypeAny> = {};
  let touched = false;
  for (const [key, field] of Object.entries(shape)) {
    const wrapped = LONG_ID_PARAM.test(key) ? wrapLongIdField(field, key) : null;
    next[key] = wrapped ?? field;
    if (wrapped) touched = true;
  }
  return touched ? z.object(next) : schema;
}
