// Test SDK integration as MCP server does
import SDK from '@opentapd/tapd-node-sdk';
import process from 'process';

console.log('=== Simulating MCP Server SDK Flow ===');

// 1. Check environment variables
console.log('\n1. Environment variables:');
console.log('TAPD_API_USER:', process.env.TAPD_API_USER ? 'SET' : 'NOT SET');
console.log('TAPD_API_PASSWORD:', process.env.TAPD_API_PASSWORD ? 'SET' : 'NOT SET');

// 2. Simulate TapdClient.fromEnv()
console.log('\n2. Creating SDK instance (like TapdClient.getSdk()):');
const client = process.env.TAPD_API_USER || '';
const secret = process.env.TAPD_API_PASSWORD || '';

console.log('client:', client || 'EMPTY');
console.log('secret:', secret ? 'HAS VALUE' : 'EMPTY');

const sdk = new SDK({
  client,
  secret,
  address: 'https://api.tapd.cn',
});

console.log('SDK instance created:', sdk);
console.log('SDK.authType:', sdk.authType);
console.log('SDK has getStories:', typeof sdk.getStories === 'function');

// 3. Test callSdk() method simulation
console.log('\n3. Testing callSdk simulation (like TapdClient.callSdk()):');
const methodName = 'getStories';
const method = sdk[methodName];

console.log('method:', method);
console.log('method type:', typeof method);

if (typeof method !== 'function') {
  console.error('ERROR: method not found');
} else {
  try {
    const params = { workspace_id: '39814312', limit: 5 };
    console.log('Calling getStories with params:', params);

    const result = await method(params);
    console.log('Result:', result);

    // Verify format
    console.log('\n4. Result format check:');
    console.log('Has status:', 'status' in result);
    console.log('Has data:', 'data' in result);
    console.log('Has info:', 'info' in result);
    console.log('status value:', result.status);

    if (result.status === 200 || result.status === 1) {
      console.log('SUCCESS: SDK call works!');
      console.log('Data:', result.data);
    } else {
      console.log('FAIL: Non-success status');
    }
  } catch (error) {
    console.error('ERROR calling method:', error.message);
    console.error('Error type:', error.constructor.name);
  }
}