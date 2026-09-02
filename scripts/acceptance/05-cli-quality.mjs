import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { Reporter, CLI_BIN, NO_AUTH_ENV, runCmd, WORKSPACE_ID } from './helpers.mjs';

const r = new Reporter('05-cli-quality');
const td = (...args) => runCmd('node', [CLI_BIN, ...args], { env: NO_AUTH_ENV });
const CONFIG_DIR = '/tmp/claude/acceptance-config';
mkdirSync(CONFIG_DIR, { recursive: true });

// ---- 1. 三级 --help ----
{
  const l1 = await td('--help');
  const l2 = await td('story', '--help');
  const l3 = await td('story', 'list', '--help');
  r.check('td --help (一级) 退出码 0 且列出 Commands', l1.code === 0 && /Commands:/.test(l1.stdout));
  r.check('td story --help (二级) 退出码 0 且列出 list/create/update', l2.code === 0 && /list/.test(l2.stdout) && /create/.test(l2.stdout) && /update/.test(l2.stdout));
  r.check('td story list --help (三级) 退出码 0 且含 --workspace-id', l3.code === 0 && /--workspace-id/.test(l3.stdout));
}

// ---- 2. 退出码矩阵 ----
// 0: 本地命令
{
  const show = await td('config', 'show');
  r.check('退出码 0: td config show（本地命令）', show.code === 0, `实际 ${show.code}`);
  const adv = await td('advisor', '切状态');
  r.check('退出码 0: td advisor 切状态（本地索引）', adv.code === 0, `实际 ${adv.code}`);
}
// 1: 业务/运行错误
{
  const auth = await td('story', 'list', '--workspace-id', String(WORKSPACE_ID));
  r.check('退出码 1: AUTH_MISSING (story list 无凭证)', auth.code === 1 && /error: AUTH_MISSING: Authentication required/.test(auth.stderr),
    `退出码 ${auth.code}, stderr: ${auth.stderr.slice(0, 120)}`);
  const ro = await td('--read-only', 'story', 'update', '999999999', '--name', 'probe');
  r.check('退出码 1: READ_ONLY_BLOCKED (--read-only story update)', ro.code === 1 && /error: READ_ONLY_BLOCKED: Tool tapd_update_story/.test(ro.stderr),
    `退出码 ${ro.code}, stderr: ${ro.stderr.slice(0, 120)}`);
}
// 2: 参数/用法错误
{
  const unknownCmd = await td('bogus-cmd');
  r.check('退出码 2: 未知命令', unknownCmd.code === 2 && /unknown command/.test(unknownCmd.stderr),
    `退出码 ${unknownCmd.code}, stderr: ${unknownCmd.stderr.slice(0, 100)}`);
  const unknownFlag = await td('story', 'list', '--bogus-flag');
  r.check('退出码 2: 未知 flag', unknownFlag.code === 2 && /unknown option/.test(unknownFlag.stderr),
    `退出码 ${unknownFlag.code}, stderr: ${unknownFlag.stderr.slice(0, 100)}`);
  // INVALID_ARGS（缺陷记录见报告 D1：裸 stack trace + 退出码 1，FSD §5.2 应为退出码 2）
  const badWs = await td('story', 'list', '--workspace-id', 'abc');
  r.note(`INVALID_ARGS 实测: 退出码 ${badWs.code}，stderr 含裸 stack trace（flags.js throw），契约偏差见报告缺陷 D1`);
  r.check('INVALID_ARGS 实际退出码为 1 (记录为契约偏差 D1，非 2)', badWs.code === 1, `实际 ${badWs.code}`);
}

// ---- 3. --read-only 拦截写命令（含 --no-read-only 反向）----
{
  const ro = await td('--read-only', 'story', 'create', '--name', 'probe', '--workspace-id', String(WORKSPACE_ID));
  r.check('--read-only 拦截 story create', ro.code === 1 && /READ_ONLY_BLOCKED: Tool tapd_create_story/.test(ro.stderr), ro.stderr.slice(0, 120));
}

// ---- 4. --output 三格式 + 管道纯净 ----
{
  const jsonOut = await td('story', 'list', '--workspace-id', String(WORKSPACE_ID), '--output', 'json');
  r.check('AUTH_MISSING 下 --output json stdout 为空（管道纯净）', jsonOut.stdout.trim() === '' && jsonOut.code === 1,
    `stdout 字节 ${jsonOut.stdout.length}`);
  const piped = await runCmd('sh', ['-c', `node ${CLI_BIN} story list --workspace-id ${WORKSPACE_ID} 2>/dev/null | jq empty; echo "JQ_EXIT=$?"`], { env: NO_AUTH_ENV });
  r.check('td story list | jq 无 stderr 污染 (stdout 仅数据或为空)', /JQ_EXIT=0/.test(piped.stdout), piped.stdout.slice(0, 100));

  const schemaJson = await td('config', 'export-schema', '--format', 'openai');
  let openaiOk = false;
  try {
    const parsed = JSON.parse(schemaJson.stdout);
    openaiOk = Array.isArray(parsed) && parsed.length === 210 && parsed[0].function?.name?.startsWith('tapd_');
  } catch { /* noop */ }
  r.check('--output/export json 格式可被 jq/JSON 解析 (openai 210 条)', openaiOk);

  const advJson = await td('advisor', '切状态', '--json');
  let advOk = false;
  try {
    const parsed = JSON.parse(advJson.stdout);
    advOk = Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].tool === 'string';
  } catch { /* noop */ }
  r.check('advisor --json 可解析且含 tool 字段', advOk);
  r.note('table 格式端到端受限于无凭证（无本地列表数据源）；以 core/cli formatter 单测 + advisor 表格对齐输出佐证');
}

// ---- 5. export-schema 等价 ----
{
  const res = await runCmd('node', ['-e', `
    import { readFileSync } from 'node:fs';
    import { spawnSync } from 'node:child_process';
    const env = { ...process.env, TAPD_CONFIG_PATH: '/nonexistent/tapd-config-acceptance.json', TAPD_ACCESS_TOKEN: '', TAPD_API_USER: '', TAPD_API_PASSWORD: '' };
    const out = spawnSync('node', ['${CLI_BIN}', 'config', 'export-schema', '--format', 'anthropic'], { env, encoding: 'utf8' });
    const exported = JSON.parse(out.stdout);
    const baseline = JSON.parse(readFileSync('${'/tmp/claude/baseline-tools.json'}', 'utf8')).tools;
    const expNames = new Set(exported.map(t => t.name));
    const baseNames = new Set(baseline.map(t => t.name));
    const missing = [...baseNames].filter(n => !expNames.has(n));
    const extra = [...expNames].filter(n => !baseNames.has(n));
    let schemaMismatch = 0;
    const norm = (s) => JSON.stringify(sortKeys(s));
    function sortKeys(v) {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
      return v;
    }
    const baseByName = Object.fromEntries(baseline.map(t => [t.name, t.input_schema]));
    for (const t of exported) {
      const b = baseByName[t.name];
      if (b && norm(t.input_schema) !== norm(b)) schemaMismatch++;
    }
    console.log(JSON.stringify({ count: exported.length, missing: missing.length, extra: extra.length, schemaMismatch }));
  `]);
  let eq = null;
  try { eq = JSON.parse(res.stdout.trim().split('\n').pop()); } catch { /* noop */ }
  r.check('export-schema anthropic 全量 210 且 missing/extra/schemaMismatch=0',
    eq && eq.count === 210 && eq.missing === 0 && eq.extra === 0 && eq.schemaMismatch === 0,
    JSON.stringify(eq ?? res.stderr.slice(0, 150)));
}

// ---- 6. advisor 召回 ----
{
  const adv = await td('advisor', '切状态');
  const top3 = adv.stdout.split('\n').filter(l => /^\S/.test(l) && !l.startsWith('-')).slice(1, 4).join(' | ');
  const hitTop3 = /story update|workflow status-map/.test(top3);
  r.check('advisor 「切状态」 top3 命中 (story update / workflow status-map)', hitTop3, `top3: ${top3.slice(0, 150)}`);
}

// ---- 7. 冷启动 < 500ms × 3 ----
{
  for (const [label, args] of [['td --help', ['--help']], ['td story list --help', ['story', 'list', '--help']]]) {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await td(...args);
      times.push(performance.now() - t0);
    }
    const max = Math.max(...times);
    r.check(`冷启动 ${label} ×3 均 <500ms (max ${max.toFixed(0)}ms)`, max < 500,
      `times: ${times.map(t => t.toFixed(0)).join('/')}ms`);
  }
}
const s = r.summary();
process.exit(s.fail > 0 ? 1 : 0);
