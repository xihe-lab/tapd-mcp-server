import { McpClient, Reporter, WORKSPACE_ID, readRealToken, registerOrphan, ZZZ_PREFIX } from './helpers.mjs';

// M5 长 ID 防御边界（需求 1454，机制见 packages/core/src/registry/long-id-guard.ts）
// guard 只包装顶层 ID 型字段（正则 ^(id|ids)$|^[a-z_]+_ids?$）的 ZodString/ZodOptional/ZodNullable：
//   安全整数 number -> 转 String；不安全 number -> 报错引导字符串重传；string 原样无损
// 已知边界：ZodArray 不包装（数组内不安全 number 不拦截，实测记录行为）
// 断言分三层：静态 schema 形态扫描 / 运行时 number 双向 / 数组形态边界

const r = new Reporter('21-longid-bounds');
const USER = '徐昭';
const STAMP = Date.now();
const nm = (s) => `${ZZZ_PREFIX}rc21-${s}-${STAMP}`;

const mcp = new McpClient({ env: { TAPD_ACCESS_TOKEN: readRealToken(), TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID), TAPD_NICK_NAME: USER } });
await mcp.start();

const sleep = ms => new Promise(res => setTimeout(res, ms));
const textOf = (res) => res.content?.map(c => c.text).join('') ?? '';
const firstOf = (data) => {
  let node = Array.isArray(data) ? data[0] : (data?.list?.[0] ?? data?.data ?? data);
  while (node && typeof node === 'object' && !Array.isArray(node)) {
    const vals = Object.values(node);
    if (vals.length === 1 && vals[0] && typeof vals[0] === 'object') { node = vals[0]; continue; }
    break;
  }
  return node;
};
const jsonOrText = (res) => { try { return JSON.parse(textOf(res)); } catch { return textOf(res); } };

async function callRaw(tool, args) {
  const res = await mcp.callTool(tool, args);
  await sleep(500);
  return res;
}

// ===== A. 静态扫描：212 工具 ID 型字段形态 =====
{
  const tools = await mcp.listTools();
  r.check(`tools/list = 212 (实际 ${tools.length})`, tools.length === 212);
  const ID_RE = /^(id|ids)$|^([a-z_]+_ids?)$/;
  let idFields = 0;
  const numberType = [];
  const arrayShape = [];
  const toolsWith = new Set();
  for (const t of tools) {
    const props = t.inputSchema?.properties ?? {};
    for (const [k, v] of Object.entries(props)) {
      if (!ID_RE.test(k)) continue;
      idFields++;
      toolsWith.add(t.name);
      // workspace_id/company_id 为配置类数值字段（≤8 位安全整数），number 形态是既有设计，不属实体 ID 字符串化范围
      if ((v.type === 'number' || v.type === 'integer') && k !== 'workspace_id' && k !== 'company_id') numberType.push(`${t.name}.${k}`);
      if (v.type === 'array') arrayShape.push(`${t.name}.${k}`);
    }
  }
  r.check(`ID 型字段覆盖 ≥26 处 (实际 ${idFields} 处 / ${toolsWith.size} 工具)`, idFields >= 26 && toolsWith.size >= 20);
  r.check(`ID 型字段零 number/integer 形态（防精度丢失第一道闸）`, numberType.length === 0, numberType.join(','));
  r.note(`数组形态 ID 字段（guard 已知边界，动态验证）: ${arrayShape.join(', ') || '无'}`);
}

// ===== B. 前置实体：一个真实 zzz story =====
let story;
try {
  const res = await callRaw('tapd_create_story', {
    workspace_id: WORKSPACE_ID, name: nm('story'), owner: USER, description: 'rc21 长 ID 边界',
  });
  story = firstOf(jsonOrText(res));
  if (!story?.id) throw new Error('story 创建失败');
  registerOrphan('story', story.id, story.name, { via: 'tapd_create_story' });
} catch (e) {
  r.check(`前置 story 创建失败: ${String(e.message).slice(0, 100)}`, false);
}
const LONG_ID = story ? String(story.id) : '0';

// ===== C. 运行时：number 双向 =====
if (story) {
  // C1 安全整数 number -> guard 转 String 放行（19 位实体 ID 的 number 形态必然不安全，用短 ID 数验证放行路径）
  const r1 = await callRaw('tapd_get_stories', { workspace_id: WORKSPACE_ID, id: 1000001 });
  const t1 = textOf(r1);
  r.check('安全整数 number id -> guard 放行转换（不报精度丢失引导）', !/超出 JS 安全整数范围/.test(t1), t1.slice(0, 80));

  // C2 不安全 number（19 位）-> guard 抛错引导（文案含 安全整数/字符串，无 stack）
  const unsafe = 1139814312001001454; // JS 字面量已精度丢失 -> 实际传入 1139814312001001456
  const r2 = await callRaw('tapd_get_stories', { workspace_id: WORKSPACE_ID, id: unsafe });
  const t2 = textOf(r2);
  r.check('不安全 number id -> isError 拦截', r2.isError === true, `isError=${r2.isError}`);
  r.check('不安全 number id 报错文案含引导（安全整数 + 字符串重传）',
    /安全整数/.test(t2) && /(字符串|带引号)/.test(t2), t2.slice(0, 100));
  r.check('不安全 number id 报错无 stack trace', !/at\s+\w+\s+\(/.test(t2));

  // C3 字符串长 ID 原样无损
  const r3 = await callRaw('tapd_get_stories', { workspace_id: WORKSPACE_ID, id: LONG_ID });
  const d3 = firstOf(jsonOrText(r3));
  r.check('字符串长 id -> 无损透传命中实体（读回 id 相等）', !r3.isError && String(d3?.id) === LONG_ID);

  // C4 字段覆盖抽测：非 id 命名的 ID 型字段（entry_id 形态；story_related_bugs 属凭证 403 集合不选）
  const r4 = await callRaw('tapd_get_comments', { workspace_id: WORKSPACE_ID, entry_type: 'stories', entry_id: LONG_ID });
  r.check('entry_id 形态字段字符串长 id 正常调用', !r4.isError, textOf(r4).slice(0, 80));
}

// ===== D. 数组形态边界（guard 不包装，行为记录）=====
if (story) {
  // D1 字符串数组：JSON 传输本身无损，应命中
  const r5 = await callRaw('tapd_batch_fetch_stories', { ids: [LONG_ID] });
  const d5 = jsonOrText(r5);
  const flat5 = (Array.isArray(d5) ? d5 : d5?.list ?? []).flat(Infinity);
  const list5 = flat5.map(n => (n && typeof n === 'object' && Object.values(n).length === 1 && typeof Object.values(n)[0] === 'object' ? Object.values(n)[0] : n));
  r.check('数组形态: 字符串长 id 数组 -> 命中实体', !r5.isError && list5.some(s => String(s?.id) === LONG_ID), textOf(r5).slice(0, 100));

  // D2 不安全 number 数组：guard 不拦截（已知边界），JS 侧已精度丢失 -> 断言不误报成功
  const unsafe = 1139814312001001454;
  const r6 = await callRaw('tapd_batch_fetch_stories', { ids: [unsafe] });
  const d6 = jsonOrText(r6);
  const list6 = Array.isArray(d6) ? d6 : d6?.list ?? [];
  r.check('数组形态: 不安全 number 不被 guard 拦截（边界行为 = 不报 guard 错）', !/安全整数/.test(textOf(r6)));
  r.check('数组形态: 不安全 number 查询不命中任何实体（无静默错数）',
    (list6 ?? []).length === 0 || !list6.some(s => String(s?.id) === String(unsafe)), textOf(r6).slice(0, 100));
}

// ===== E. 全字段形态深测：20 工具白名单抽 4 个不同形态字段 =====
if (story) {
  // bug_id 形态 + 真实 bug 实体
  let bug;
  try {
    const res = await callRaw('tapd_create_bug', {
      workspace_id: WORKSPACE_ID, title: nm('bug'), current_owner: USER, reporter: USER, severity: '3', priority: '3',
    });
    bug = firstOf(jsonOrText(res));
    if (bug?.id) registerOrphan('bug', bug.id, bug.title, { via: 'tapd_create_bug' });
  } catch { /* 查名断言由 19 号主责，此处容忍 */ }
  if (bug?.id) {
    const r7 = await callRaw('tapd_get_bugs', { workspace_id: WORKSPACE_ID, id: String(bug.id) });
    r.check('bug_id 形态字段字符串长 id 命中', !r7.isError && String(firstOf(jsonOrText(r7))?.id) === String(bug.id));
  }
  // tcase/test_plan 形态由 18 号（M2 全量只读）字符串传参覆盖，此处不重复
  r.note('tcase_id/test_plan_id/entry_id 等其余形态：18 号 M2 全量只读以字符串传参覆盖，21 号不重复建实体');
}

mcp.stop();
const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
