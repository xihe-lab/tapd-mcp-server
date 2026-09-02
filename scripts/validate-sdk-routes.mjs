import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDK_ROUTES } from '../packages/core/dist/sdk-routes.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'packages/core', 'package.json'));
const sdkEntry = require.resolve('@opentapd/tapd-node-sdk');
const sdkSource = readFileSync(sdkEntry, 'utf8');
const sdkVersion = JSON.parse(readFileSync(require.resolve('@opentapd/tapd-node-sdk/package.json'), 'utf8')).version;

const generated = new Map();
const pattern = /(\w+)\(\.\.\.args\)\s*\{\s*return this\.oAuthRequest\.apply\(\s*this,\s*\[\s*'([^']+)',\s*'([A-Z]+)',/g;
let match;
while ((match = pattern.exec(sdkSource)) !== null) {
  generated.set(match[1], { path: match[2], method: match[3] });
}

if (generated.size === 0) {
  console.error(`validate-sdk-routes: parsed 0 methods from ${sdkEntry} — parser or SDK format changed`);
  process.exit(1);
}

const errors = [];
const entries = Object.entries(SDK_ROUTES);

for (const [key, methodName] of entries) {
  const [routeMethod, routePath] = key.split(' ');
  const impl = generated.get(methodName);
  if (!impl) {
    errors.push(`${key} -> '${methodName}' does not exist in @opentapd/tapd-node-sdk`);
    continue;
  }
  if (impl.path !== routePath || impl.method !== routeMethod) {
    errors.push(`${key} -> '${methodName}' but SDK maps it to ${impl.method} ${impl.path}`);
  }
}

console.log(`validate-sdk-routes: SDK ${sdkVersion}, ${entries.length} routes checked against ${generated.size} generated methods`);
if (errors.length > 0) {
  console.error('validate-sdk-routes: FAILED');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('validate-sdk-routes: OK');
