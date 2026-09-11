// TAPD API 实体包裹形态解包：[{Story:{...}}] → [{...,__entity:'Story'}]
//
// 真实 API（与 MCP 同源）返回单键包裹形态，如 {"Story":{"id":...}} / {"Iteration":{...}}；
// 模板的 filter/expr/插值按扁平字段书写（item.name / item.status）。
// 模板声明 `unwrap: true` 后，引擎在每个工具步骤取回数据后、过滤前统一拍平，
// 并以 __entity 保留原包裹键便于溯源与按类型分组。

/** 单个对象：恰好一个首字母大写的键且值为对象 → 展开该对象并附 __entity */
function unwrapOne(item: unknown): unknown {
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
    const keys = Object.keys(item);
    if (keys.length === 1 && /^[A-Z][A-Za-z0-9]*$/.test(keys[0]!)) {
      const inner = (item as Record<string, unknown>)[keys[0]!];
      if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
        return { ...(inner as Record<string, unknown>), __entity: keys[0] };
      }
    }
  }
  return item;
}

/** 数组逐项解包；单对象同样处理；其余原样返回（count 等小写键不受影响） */
export function unwrapEntities(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(unwrapOne);
  return unwrapOne(data);
}
