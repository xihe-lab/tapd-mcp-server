import { spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../..', import.meta.url));

// 被测对象切换（评审修订 7，单一 env）：TAPD_TEST_BIN=产物 bin 目录（含 tapd / tapd-mcp-server，如 npm 全局 bin 目录）；不设为源码 dist
const TEST_BIN_DIR = process.env.TAPD_TEST_BIN;
export const SOURCE_MCP_BIN = `${REPO}/packages/mcp/dist/bin/tapd-mcp-server.js`;
export const SOURCE_CLI_BIN = `${REPO}/packages/cli/dist/bin/tapd.js`;
export const MCP_BIN = TEST_BIN_DIR ? `${TEST_BIN_DIR}/tapd-mcp-server` : SOURCE_MCP_BIN;
export const CLI_BIN = TEST_BIN_DIR ? `${TEST_BIN_DIR}/tapd` : SOURCE_CLI_BIN;
export const OLD_MCP_BIN = '/tmp/claude/tapd-v142/dist/index.js';
export const BASELINE_143 = '/tmp/claude/baseline-tools-143.json';
export const WORKSPACE_ID = 39814312;

export const ZZZ_PREFIX = 'zzz-delete-me-';
export const ORPHAN_LEDGER = '/tmp/claude/tapd-rc-orphan-ledger.jsonl';

// C2：真实 ~/.tapd/config.json 只读；需要写 config 的用例一律对副本操作
export function ensureConfigCopy() {
  mkdirSync('/tmp/claude', { recursive: true });
  const dest = '/tmp/claude/tapd-rc-config-copy.json';
  copyFileSync(`${homedir()}/.tapd/config.json`, dest);
  return dest;
}

// 凭证纪律：token 仅进程内读出注入子进程 env，不打印明文
export function readRealToken() {
  const config = JSON.parse(readFileSync(`${homedir()}/.tapd/config.json`, 'utf8'));
  if (!config.access_token) throw new Error('~/.tapd/config.json 无 access_token');
  return config.access_token;
}

// 修订 5 孤儿登记：已创建实体 ID 实时登记，无论其所属工具后续成败；清理清单唯一底稿
export function registerOrphan(kind, id, name, extra = {}) {
  mkdirSync('/tmp/claude', { recursive: true });
  appendFileSync(ORPHAN_LEDGER, JSON.stringify({ ts: new Date().toISOString(), kind, id: String(id), name: String(name ?? ''), ...extra }) + '\n');
}

// C3 前缀防御：任何 ID 型入参对应的实体名必须带 zzz-delete-me- 前缀，否则中止
export function expectZzz(name, context) {
  if (!String(name ?? '').startsWith(ZZZ_PREFIX)) {
    throw new Error(`[C3 前缀防御中止] ${context}: "${name}" 缺 ${ZZZ_PREFIX} 前缀`);
  }
}

export const NO_CONFIG_ENV = {
  TAPD_CONFIG_PATH: '/nonexistent/tapd-config-acceptance.json',
};

export const NO_AUTH_ENV = {
  ...NO_CONFIG_ENV,
  TAPD_ACCESS_TOKEN: '',
  TAPD_API_USER: '',
  TAPD_API_PASSWORD: '',
};

export function runCmd(cmd, args, { env = {}, cwd = REPO, timeoutMs = 30_000, input } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ code: -1, stdout: stdout.toString(), stderr: stderr.toString(), timedOut: true });
    }, timeoutMs);
    proc.stdout.on('data', d => { stdout = Buffer.concat([stdout, d]); });
    proc.stderr.on('data', d => { stderr = Buffer.concat([stderr, d]); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: stdout.toString(), stderr: stderr.toString(), timedOut: false });
    });
    if (input !== undefined) proc.stdin.write(input);
    proc.stdin.end();
  });
}

export class McpClient {
  // cmd 提供时以 spawn(cmd, cmdArgs) 启动（npx 等场景），否则 spawn(nodeBin, [bin])
  constructor({ env = {}, bin = MCP_BIN, nodeBin = 'node', cmd, cmdArgs = [] } = {}) {
    this.env = env;
    this.bin = bin;
    this.nodeBin = nodeBin;
    this.cmd = cmd;
    this.cmdArgs = cmdArgs;
    this.nextId = 1;
  }

  async start() {
    this.proc = this.cmd
      ? spawn(this.cmd, this.cmdArgs, {
          env: { ...process.env, ...this.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      : spawn(this.nodeBin, [this.bin], {
          env: { ...process.env, ...this.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.stderrTail = '';
    this.proc.stdout.on('data', d => this.#onData(d));
    this.proc.stderr.on('data', d => { this.stderrTail = (this.stderrTail + d).slice(-2000); });
    const init = await this.request('initialize', {
      protocolVersion: '2024-10-07',
      capabilities: {},
      clientInfo: { name: 'tapd-acceptance', version: '1.0.0' },
    });
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return init;
  }

  #onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    let idx;
    while ((idx = this.buf.indexOf(0x0A)) >= 0) {
      const line = this.buf.subarray(0, idx).toString('utf8');
      this.buf = this.buf.subarray(idx + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    }
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 20_000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  async listTools() {
    const res = await this.request('tools/list', {});
    return res.tools;
  }

  async callTool(name, args) {
    const res = await this.request('tools/call', { name, arguments: args });
    return res;
  }

  stop() {
    if (this.proc) {
      this.proc.kill('SIGKILL');
      this.proc = null;
    }
  }
}

export class Reporter {
  constructor(name) {
    this.name = name;
    this.pass = 0;
    this.fail = 0;
    this.failures = [];
    this.notes = [];
  }

  check(label, ok, detail = '') {
    if (ok) {
      this.pass++;
      console.log(`  PASS ${label}`);
    } else {
      this.fail++;
      this.failures.push({ label, detail });
      console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
  }

  note(text) {
    this.notes.push(text);
    console.log(`  NOTE ${text}`);
  }

  summary() {
    const status = this.fail === 0 ? 'ALL PASS' : 'HAS FAILURES';
    console.log(`\n[${this.name}] ${this.pass} pass, ${this.fail} fail — ${status}`);
    return { name: this.name, pass: this.pass, fail: this.fail, failures: this.failures, notes: this.notes };
  }
}
