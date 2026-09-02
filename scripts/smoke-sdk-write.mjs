import { TapdClient } from '../packages/core/dist/index.js';

const accessToken = process.env.TAPD_ACCESS_TOKEN;
const workspaceId = process.env.TAPD_DEFAULT_WORKSPACE_ID;
const nick = process.env.TAPD_NICK_NAME ?? '徐昭';

if (!accessToken || !workspaceId) {
  console.error('usage: TAPD_ACCESS_TOKEN=... TAPD_DEFAULT_WORKSPACE_ID=... node scripts/smoke-sdk-write.mjs (OAuth required for writes)');
  process.exit(2);
}

const client = TapdClient.fromAccessToken(accessToken);
process.env.TAPD_SDK_DISABLED = '1';
const fetchOnly = TapdClient.fromAccessToken(accessToken);
delete process.env.TAPD_SDK_DISABLED;

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
let iterationId = process.env.SMOKE_ITERATION_ID;

try {
  if (!iterationId) {
    console.log(`POST /iterations (SDK route) create sdk-write-smoke-${stamp} ...`);
    const created = await client.post('/iterations', {
      workspace_id: workspaceId,
      name: `sdk-write-smoke-${stamp}`,
      startdate: stamp.slice(0, 8),
      enddate: `${stamp.slice(0, 4)}-12-31`,
      creator: nick,
    });
    iterationId = created.Iteration?.id;
    console.log(`  created iteration id=${iterationId}`);

    const fetched = await client.get('/iterations', { workspace_id: workspaceId, fields: 'id,name', id: iterationId });
    const match = fetched.find?.(i => String(i.Iteration?.id) === String(iterationId))?.Iteration;
    console.log(`  verify via GET /iterations (id filter): ${match ? `found name="${match.name}"` : 'NOT FOUND'}`);
  }

  const newName = `sdk-write-smoke-renamed-${stamp}`;
  const updated = await client.post('/iterations', { workspace_id: workspaceId, id: iterationId, name: newName, current_user: nick });
  console.log(`  POST /iterations (SDK route) update -> name="${updated.Iteration?.name ?? newName}"`);

  const refetch = await client.get('/iterations', { workspace_id: workspaceId, fields: 'id,name', id: iterationId });
  const refetched = refetch.find?.(i => String(i.Iteration?.id) === String(iterationId))?.Iteration;
  console.log(`  verify rename via GET (SDK route): name="${refetched?.name}"`);

  if (!process.env.SMOKE_ITERATION_ID) {
    await fetchOnly.post('/iterations', { workspace_id: workspaceId, id: iterationId, name: `zzz-delete-me-sdk-smoke-${stamp}`, current_user: nick });
    console.log(`  renamed to "zzz-delete-me-sdk-smoke-${stamp}" via fetch path (TAPD has no iteration delete API, see report)`);
  }
  console.log('WRITE SMOKE OK');
} catch (error) {
  console.error(`WRITE SMOKE FAILED: ${error.message}`);
  if (iterationId) console.error(`  leftover iteration id=${iterationId} in workspace ${workspaceId}`);
  process.exit(1);
}
