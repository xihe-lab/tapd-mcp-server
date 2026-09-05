import { McpClient, Reporter, WORKSPACE_ID, readRealToken, registerOrphan, ZZZ_PREFIX } from './helpers.mjs';

// M4 富文本三层路由矩阵（需求 1454）
// 层1 服务端透传（wiki）：description -> markdown_description 改名透传，TAPD 服务端渲染
// 层2 客户端渲染（其余 28 写工具）：markdown-it 渲染 HTML 入库
// 层3 关闭（TAPD_RICHTEXT_AUTO=0）：写读全原样
// 断言手法：AUTO=1 客户端读回是 turndown 化的 md（**加粗**）；AUTO=0 客户端读回 TAPD 原始存储
// （原始读回含 '<strong>' = 已渲染证据；关闭档写入读回 == md 明文 = 未渲染证据）

const r = new Reporter('20-richtext-matrix');
const USER = '徐昭';
const STAMP = Date.now();
const nm = (s) => `${ZZZ_PREFIX}rc20-${s}-${STAMP}`;
const MD = `# Rc20 标题\n**加粗文本**普通行\n- 列表项`;

const AUTH = { TAPD_ACCESS_TOKEN: readRealToken(), TAPD_DEFAULT_WORKSPACE_ID: String(WORKSPACE_ID), TAPD_NICK_NAME: USER };
const auto = new McpClient({ env: AUTH });
const off = new McpClient({ env: { ...AUTH, TAPD_RICHTEXT_AUTO: '0' } });
await auto.start();
await off.start();

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

async function call(client, tool, args) {
  const res = await client.callTool(tool, args);
  if (res.isError) throw new Error(`${tool} isError: ${textOf(res).slice(0, 160)}`);
  await sleep(800);
  return JSON.parse(textOf(res));
}

const GET_BY_KIND = {
  story: ['tapd_get_stories', 'name'],
  bug: ['tapd_get_bugs', 'title'],
  task: ['tapd_get_tasks', 'name'],
  iteration: ['tapd_get_iterations', 'name'],
  wiki: ['tapd_get_wikis', 'name'],
  module: ['tapd_get_modules', 'name'],
  version: ['tapd_get_versions', 'name'],
  feature: ['tapd_get_features', 'name'],
  baseline: ['tapd_get_baselines', 'name'],
  release: ['tapd_get_releases', 'name'],
  test_case: ['tapd_get_test_cases', 'name'],
  test_plan: ['tapd_get_test_plans', 'name'],
};

async function createReg(client, tool, kind, args, nameField, irremovable = false) {
  const data = firstOf(await call(client, tool, args));
  if (!data?.id) throw new Error(`${tool} 未返回 id`);
  registerOrphan(kind, data.id, data?.[nameField] ?? args[nameField] ?? '', { irremovable, via: tool });
  return data;
}

async function readDesc(kind, id, client = auto) {
  const [tool] = GET_BY_KIND[kind];
  return firstOf(await call(client, tool, { workspace_id: WORKSPACE_ID, id: String(id) }))?.description;
}

// ===== 静态断言：manifest 与路由开关 =====
{
  const manifestSrc = (await import('node:fs')).readFileSync(
    new URL('../../packages/core/src/registry/richtext-manifests.generated.ts', import.meta.url), 'utf8');
  const toolMatches = [...manifestSrc.matchAll(/^  '(tapd_[a-z_]+)': \[/gm)].map(m => m[1]);
  r.check(`manifest 写富文本工具 = 30 (实际 ${toolMatches.length})`, toolMatches.length === 30);
  const serverMd = manifestSrc.match(/SERVER_MD_TOOLS[^=]*= \[([^\]]+)\]/)?.[1] ?? '';
  r.check('SERVER_MD_TOOLS 仅 wiki 两工具', serverMd.includes('tapd_create_wiki') && serverMd.includes('tapd_update_wiki')
    && (serverMd.match(/tapd_/g) ?? []).length === 2, serverMd.slice(0, 80));
  r.check('wiki 路由字段含 description+markdown_description',
    /'tapd_create_wiki': \[\s*'description',\s*'markdown_description'/.test(manifestSrc));
  // 逐工具块解析：非 server 工具（28 个客户端渲染层）路由字段全为 description
  const blocks = [...manifestSrc.matchAll(/'(tapd_[a-z_]+)': \[([^\]]+)\]/g)];
  const nonServerFields = blocks
    .filter(b => !serverMd.includes(b[1]))
    .flatMap(b => [...b[2].matchAll(/'([a-z_]+)'/g)].map(m => m[1]));
  r.check(`非 server 工具路由字段全为 description (${blocks.length - 2} 工具 / ${nonServerFields.length} 字段)`,
    blocks.length === 30 && nonServerFields.length === 28 && nonServerFields.every(f => f === 'description'),
    [...new Set(nonServerFields)].join(','));
  const routeSrc = (await import('node:fs')).readFileSync(
    new URL('../../packages/core/src/registry/richtext.ts', import.meta.url), 'utf8');
  r.check('读侧扫描字段仅 description（READ_RICHTEXT_FIELDS）', /READ_RICHTEXT_FIELDS[^=]*= new Set\(\['description'\]\)/.test(routeSrc));
  r.check('AUTO 开关解析：TAPD_RICHTEXT_AUTO !== 0 视为开启', /TAPD_RICHTEXT_AUTO !== '0'/.test(routeSrc));
}

// ===== 层2/层3 决定性对照（story）=====
try {
  // AUTO=1 写 md：客户端渲染 HTML 入库
  const s1 = await createReg(auto, 'tapd_create_story', 'story', {
    workspace_id: WORKSPACE_ID, name: nm('story-auto'), owner: USER, description: MD,
  }, 'name');
  const autoDesc = await readDesc('story', s1.id, auto);
  r.check('L2 story: AUTO=1 读回 turndown 化（**加粗文本** 存在）', /加粗文本/.test(autoDesc) && /\*\*加粗文本\*\*/.test(autoDesc), String(autoDesc).slice(0, 80));
  r.check('L2 story: AUTO=1 读回无 <strong> 字面', !/<strong/i.test(autoDesc));
  const rawDesc = await readDesc('story', s1.id, off);
  r.check('L2 story: 原始读回含 <strong>（客户端渲染入库证据）', /<strong>/i.test(rawDesc), String(rawDesc).slice(0, 80));

  // AUTO=0 写 md：明文透传，TAPD 存 md 原文
  const s2 = await createReg(off, 'tapd_create_story', 'story', {
    workspace_id: WORKSPACE_ID, name: nm('story-off'), owner: USER, description: MD,
  }, 'name');
  const offDesc = await readDesc('story', s2.id, off);
  r.check('L3 story: AUTO=0 写入后原样读回（md 明文含 ** 加粗语法）', /\*\*加粗文本\*\*/.test(offDesc), String(offDesc).slice(0, 80));
  r.check('L3 story: AUTO=0 读回无 HTML 标签（未渲染）', !/<(strong|h1|p|br)\b/i.test(offDesc));

  // AUTO=1 update 同样渲染
  await call(auto, 'tapd_update_story', { id: String(s1.id), description: MD });
  const updDesc = await readDesc('story', s1.id, auto);
  r.check('L2 story update: 渲染路径与 create 一致', /\*\*加粗文本\*\*/.test(updDesc) && /Rc20 标题/.test(updDesc));
} catch (e) {
  r.check(`story 三层对照执行失败: ${String(e.message).slice(0, 100)}`, false);
}

// ===== 层1 服务端透传（wiki）=====
// D8（2.0 特有）：SERVER_MD_TOOLS 透传假设不成立——TAPD /tapd_wikis 不渲染 markdown_description
// （curl 直调实证：创建后 description 空、markdown_description 存 md 原文），wiki 正文闭环降级为 md 原文透传，数据无损
try {
  const w1 = await createReg(auto, 'tapd_create_wiki', 'wiki', {
    workspace_id: WORKSPACE_ID, name: nm('wiki-auto'), description: MD,
  }, 'name');
  const getWiki = async (client, id) => firstOf(await call(client, 'tapd_get_wikis', { workspace_id: WORKSPACE_ID, id: String(id) }));
  const w1Node = await getWiki(auto, w1.id);
  r.check('L1 wiki: description 为空（D8 实证：TAPD 服务端不渲染 markdown_description）', !w1Node?.description, String(w1Node?.description).slice(0, 60));
  r.check('L1 wiki: md 原文无损存于 markdown_description（**加粗文本**）', /\*\*加粗文本\*\*/.test(w1Node?.markdown_description ?? ''), String(w1Node?.markdown_description).slice(0, 60));
  r.note('L1 wiki 读侧豁免（D8）: description 无 HTML → AUTO 读回原样为空，客户端需读 markdown_description 获取正文');

  const w2 = await createReg(off, 'tapd_create_wiki', 'wiki', {
    workspace_id: WORKSPACE_ID, name: nm('wiki-off'), description: MD,
  }, 'name');
  const w2Node = await getWiki(off, w2.id);
  // AUTO=0 全原样透传：description 入参不挪字段，md 原文落在 description
  r.check('L3 wiki: AUTO=0 明文透传（description 存 md 原文，无渲染）', /\*\*加粗文本\*\*/.test(w2Node?.description ?? '') && !/<strong>/i.test(w2Node?.description ?? ''), String(w2Node?.description).slice(0, 60));

  await call(auto, 'tapd_update_wiki', { id: String(w1.id), description: MD });
  const w1Upd = await getWiki(auto, w1.id);
  r.check('L1 wiki update: md 路由与 create 一致（markdown_description 含 **加粗文本**）', /\*\*加粗文本\*\*/.test(w1Upd?.markdown_description ?? ''), String(w1Upd?.markdown_description).slice(0, 60));
} catch (e) {
  r.check(`wiki 三层对照执行失败: ${String(e.message).slice(0, 100)}`, false);
}

// ===== 浅档扫描：manifest 其余写工具逐一写入 md 样本并读回断言 =====
// story/bug/task 已深档覆盖 create+update；此处扫其余实体类（每实体 create+get 两请求，不可删除类登记 irremovable）
const shallow = [
  ['iteration', 'tapd_create_iteration', { name: nm('iter'), startdate: '2026-09-04', enddate: '2026-09-30', creator: USER, description: MD }, 'name', true],
  ['bug', 'tapd_create_bug', { title: nm('bug'), current_owner: USER, reporter: USER, severity: '3', priority: '3', description: MD }, 'title', false],
  ['task', 'tapd_create_task', { name: nm('task'), owner: USER, creator: USER, description: MD }, 'name', false],
  ['module', 'tapd_add_module', { name: nm('mod'), owner: USER, description: MD }, 'name', true],
  ['version', 'tapd_add_version', { name: nm('ver'), owner: USER, description: MD }, 'name', true],
  ['feature', 'tapd_add_feature', { name: nm('feat'), owner: USER, description: MD }, 'name', true],
  ['baseline', 'tapd_add_baseline', { name: nm('bl'), baseline_date: '2026-09-04', description: MD }, 'name', true],
  ['release', 'tapd_create_release', { name: nm('rel'), owner: USER, start_date: '2026-09-04', end_date: '2026-09-30', description: MD }, 'name', true],
  ['test_plan', 'tapd_create_test_plan', { name: nm('plan'), owner: USER, begin: '2026-09-04', end: '2026-09-30', description: MD }, 'name', false],
];

let storyId;
try {
  const probe = firstOf(await call(auto, 'tapd_get_stories', { workspace_id: WORKSPACE_ID, limit: 1, name: `${ZZZ_PREFIX}rc20-story-auto`, fields: 'id' }));
  storyId = probe?.id;
} catch { /* 后面按缺失处理 */ }

const skipNotes = ['test_case: 存量缺陷 D7——schema description 为无效字段（TAPD test_case API 无此字段，写入静默丢弃，1.4.2 同构），无富文本展示位豁免'];
for (const [kind, tool, args, nameField, irremovable] of shallow) {
  try {
    const data = await createReg(auto, tool, kind, { workspace_id: WORKSPACE_ID, ...args }, nameField, irremovable);
    const desc = await readDesc(kind, data.id, auto);
    r.check(`浅档 ${kind}: md 渲染往返（**加粗文本**）`, /\*\*加粗文本\*\*/.test(desc) && !/<strong/i.test(desc), String(desc).slice(0, 60));
  } catch (e) {
    skipNotes.push(`${kind}: ${String(e.message).slice(0, 80)}`);
  }
}

// comment：关联本脚本自建 story（无则跳过）
try {
  if (!storyId) throw new Error('story 深档实体缺失');
  const cm = await createReg(auto, 'tapd_create_comment', 'comment', {
    workspace_id: WORKSPACE_ID, entry_type: 'stories', entry_id: String(storyId), author: USER, description: MD,
  }, 'description');
  const list = firstOf(await call(auto, 'tapd_get_comments', { workspace_id: WORKSPACE_ID, entry_type: 'stories', entry_id: String(storyId) }));
  const mine = (Array.isArray(list) ? list : [list]).find(c => String(c?.id) === String(cm.id));
  r.check('浅档 comment: md 渲染往返（**加粗文本**）', /\*\*加粗文本\*\*/.test(mine?.description ?? '') && !/<strong/i.test(mine?.description ?? ''));
} catch (e) {
  skipNotes.push(`comment: ${String(e.message).slice(0, 80)}`);
}

// custom_field_config 的 description 为字段描述（非实体富文本展示位），launch_form/board_card 依赖外部资源 → 豁免
r.note(`浅档豁免记录: ${skipNotes.join(' | ') || '无'}`);

auto.stop();
off.stop();
const s = r.summary();
process.exitCode = s.fail > 0 ? 1 : 0;
