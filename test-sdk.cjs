// Quick test to verify SDK import and initialization
const SDK = require('@opentapd/tapd-node-sdk');

console.log('SDK class:', SDK);
console.log('SDK type:', typeof SDK);

// Test instantiation
try {
  const sdk = new SDK({
    client: process.env.TAPD_API_USER || '',
    secret: process.env.TAPD_API_PASSWORD || '',
    address: 'https://api.tapd.cn',
  });

  console.log('SDK instance created:', sdk);
  console.log('SDK.client:', sdk.client);
  console.log('SDK.secret:', sdk.secret);
  console.log('SDK.authType:', sdk.authType);
  console.log('SDK has getStories method:', typeof sdk.getStories);

} catch (error) {
  console.error('SDK instantiation failed:', error);
}