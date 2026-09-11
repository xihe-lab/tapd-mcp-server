// Test SDK import with ES module syntax
import SDK from '@opentapd/tapd-node-sdk';

console.log('SDK imported:', SDK);
console.log('SDK type:', typeof SDK);
console.log('SDK is function:', typeof SDK === 'function');

try {
  // Test 1: Create SDK instance with empty credentials
  const sdk1 = new SDK({
    client: '',
    secret: '',
    address: 'https://api.tapd.cn',
  });
  console.log('\nTest 1: SDK created with empty creds');
  console.log('sdk1:', sdk1);
  console.log('sdk1.authType:', sdk1.authType);
  console.log('sdk1.getStories:', typeof sdk1.getStories);

  // Test 2: Try to call a method (should fail with auth error, not undefined error)
  try {
    const result = await sdk1.getStories({ workspace_id: '39814312', limit: 5 });
    console.log('Test 2: getStories result:', result);
  } catch (error) {
    console.log('Test 2: getStories error (expected):', error.message);
    // This error should be auth-related, NOT "undefined"
  }

  // Test 3: Check SDK methods exist
  console.log('\nTest 3: Checking SDK methods exist');
  console.log('getStories:', typeof sdk1.getStories);
  console.log('getBugs:', typeof sdk1.getBugs);
  console.log('getTasks:', typeof sdk1.getTasks);
  console.log('getIterations:', typeof sdk1.getIterations);

} catch (error) {
  console.error('SDK test failed:', error);
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
}