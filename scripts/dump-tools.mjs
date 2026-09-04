import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const cwd = process.argv[2];
const outFile = process.argv[3];
const cmd = process.argv[4];
const args = process.argv.slice(5);

const proc = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

const send = (msg) => proc.stdin.write(JSON.stringify(msg) + '\n');

const responses = new Map();
let buffer = Buffer.alloc(0);

proc.stdout.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  let idx;
  while ((idx = buffer.indexOf(0x0A)) !== -1) {
    const line = buffer.subarray(0, idx).toString('utf8').trim();
    buffer = buffer.subarray(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined) responses.set(msg.id, msg);
    } catch { /* non-JSON line, ignore */ }
  }
});

proc.stderr.on('data', () => {});

const fail = (reason) => {
  console.error('FAIL: ' + reason);
  proc.kill('SIGKILL');
  process.exit(1);
};

const timer = setTimeout(() => fail('timeout waiting for tools/list'), 60000);

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'dump-tools', version: '0.0.0' },
} });

const poll = setInterval(() => {
  if (!responses.has(1)) return;
  clearInterval(poll);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

  const poll2 = setInterval(() => {
    if (!responses.has(2)) return;
    clearInterval(poll2);
    clearTimeout(timer);
    const result = responses.get(2).result;
    writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`OK: ${result.tools.length} tools -> ${outFile}`);
    proc.kill('SIGKILL');
    process.exit(0);
  }, 200);
}, 200);
