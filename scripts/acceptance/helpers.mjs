import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

export const REPO = '/Users/xuzhao/workspace/xihe-lab/tapd-mcp-server';
export const MCP_BIN = `${REPO}/packages/mcp/dist/bin/tapd-mcp-server.js`;
export const OLD_MCP_BIN = '/tmp/claude/tapd-v142/dist/index.js';
export const CLI_BIN = `${REPO}/packages/cli/dist/bin/tapd.js`;
export const BASELINE = '/tmp/claude/baseline-tools.json';
export const WORKSPACE_ID = 39814312;

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
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ code: -1, stdout, stderr, timedOut: true });
    }, timeoutMs);
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, timedOut: false });
    });
    if (input !== undefined) proc.stdin.write(input);
    proc.stdin.end();
  });
}

export class McpClient {
  constructor({ env = {}, bin = MCP_BIN } = {}) {
    this.env = env;
    this.bin = bin;
    this.nextId = 1;
  }

  async start() {
    this.proc = spawn('node', [this.bin], {
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.buf = '';
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
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
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
