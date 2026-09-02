import { TapdClient } from '../packages/core/dist/index.js';

const accessToken = process.env.TAPD_ACCESS_TOKEN;
const apiUser = process.env.TAPD_API_USER;
const apiPassword = process.env.TAPD_API_PASSWORD;
const workspaceId = process.env.TAPD_DEFAULT_WORKSPACE_ID;

if (!workspaceId || (!accessToken && !(apiUser && apiPassword))) {
  console.error('usage: TAPD_ACCESS_TOKEN=... (or TAPD_API_USER/TAPD_API_PASSWORD) TAPD_DEFAULT_WORKSPACE_ID=... node scripts/compare-sdk-fetch.mjs');
  process.exit(2);
}

const auth = accessToken
  ? TapdClient.fromAccessToken(accessToken)
  : TapdClient.fromBasicAuth(apiUser, apiPassword);

process.env.TAPD_SDK_DISABLED = '1';
const fetchOnly = accessToken
  ? TapdClient.fromAccessToken(accessToken)
  : TapdClient.fromBasicAuth(apiUser, apiPassword);
delete process.env.TAPD_SDK_DISABLED;

const cases = [
  ['GET /stories', { workspace_id: workspaceId, fields: 'id,name,status,owner', limit: 3 }],
  ['GET /stories/count', { workspace_id: workspaceId }],
  ['GET /stories/custom_fields_settings', { workspace_id: workspaceId }],
  ['GET /bugs', { workspace_id: workspaceId, fields: 'id,title,status', limit: 3 }],
  ['GET /bugs/count', { workspace_id: workspaceId }],
  ['GET /bugs/custom_fields_settings', { workspace_id: workspaceId }],
  ['GET /tasks', { workspace_id: workspaceId, fields: 'id,name,status', limit: 3 }],
  ['GET /tasks/count', { workspace_id: workspaceId }],
  ['GET /iterations', { workspace_id: workspaceId, limit: 3 }],
  ['GET /iterations/count', { workspace_id: workspaceId }],
  ['GET /tapd_wikis', { workspace_id: workspaceId, fields: 'id,title', limit: 3 }],
  ['GET /tapd_wikis/count', { workspace_id: workspaceId }],
  ['GET /comments', { workspace_id: workspaceId, limit: 2 }],
  ['GET /workflows', { workspace_id: workspaceId, system: 'story' }],
  ['GET /workflows/status_map', { workspace_id: workspaceId, system: 'story' }],
  ['GET /timesheets', { workspace_id: workspaceId, limit: 2 }],
  ['GET /story_changes', { workspace_id: workspaceId, limit: 2 }],
  ['GET /test_plans', { workspace_id: workspaceId, limit: 2 }],
];

let pass = 0;
let fail = 0;
const failures = [];

for (const [routeKey, params] of cases) {
  const path = routeKey.split(' ')[1];
  try {
    const sdkResult = await auth.get(path, params);
    const fetchResult = await fetchOnly.get(path, params);
    const sdkJson = JSON.stringify(sdkResult);
    const fetchJson = JSON.stringify(fetchResult);
    if (sdkJson === fetchJson) {
      console.log(`PASS ${routeKey}`);
      pass++;
    } else {
      console.log(`FAIL ${routeKey}`);
      let at = 0;
      while (sdkJson[at] === fetchJson[at] && at < Math.min(sdkJson.length, fetchJson.length)) at++;
      console.log(`  first diff at ${at}: sdk=${sdkJson.slice(Math.max(0, at - 40), at + 80)} fetch=${fetchJson.slice(Math.max(0, at - 40), at + 80)}`);
      fail++;
      failures.push(path);
    }
  } catch (error) {
    console.log(`ERROR ${routeKey}: ${error.message}`);
    fail++;
    failures.push(routeKey);
  }
}

console.log(`\ncompare-sdk-fetch: ${pass} pass, ${fail} fail (auth=${accessToken ? 'oauth' : 'basic'})`);
if (fail > 0) process.exit(1);
