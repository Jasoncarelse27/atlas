// Atlas MailerLite Fix Verification Script
// Run this in browser console to verify the fix

console.log('🔍 Atlas MailerLite Fix Verification');
console.log('====================================\n');

// Monitor network requests
const originalFetch = window.fetch;
let mailerLiteCallCount = 0;
const mailerLiteCalls = [];

window.fetch = function(...args) {
  const url = args[0];
  if (url && url.includes('mailerlite/proxy')) {
    mailerLiteCallCount++;
    const timestamp = new Date().toISOString();
    mailerLiteCalls.push({
      timestamp,
      url,
      count: mailerLiteCallCount
    });
    console.log(`📡 MailerLite API call #${mailerLiteCallCount} at ${timestamp}`);
  }
  return originalFetch.apply(this, args);
};

console.log('✅ Monitoring started for MailerLite API calls\n');
console.log('Expected behavior after fix:');
console.log('1. Calls should be debounced (5 second minimum between updates)');
console.log('2. No calls on every message load');
console.log('3. Conversation count updates only when actual conversations change\n');

console.log('Test instructions:');
console.log('1. Send a few messages rapidly');
console.log('2. You should NOT see multiple MailerLite calls immediately');
console.log('3. Updates should be batched and debounced\n');

// Add report function
window.mailerLiteReport = () => {
  console.log('\n📊 MailerLite API Call Report');
  console.log('=============================');
  console.log(`Total calls: ${mailerLiteCallCount}`);
  
  if (mailerLiteCalls.length > 1) {
    console.log('\nCall timing analysis:');
    for (let i = 1; i < mailerLiteCalls.length; i++) {
      const timeDiff = new Date(mailerLiteCalls[i].timestamp) - new Date(mailerLiteCalls[i-1].timestamp);
      console.log(`Call ${i} → ${i+1}: ${timeDiff}ms apart ${timeDiff < 5000 ? '⚠️ Too fast!' : '✅ Properly debounced'}`);
    }
  }
  
  console.log('\nDetailed calls:');
  mailerLiteCalls.forEach((call, index) => {
    console.log(`${index + 1}. ${call.timestamp}`);
  });
};

console.log('💡 Type window.mailerLiteReport() to see detailed analysis\n');

// Check React Query cache
setTimeout(() => {
  try {
    const queryClient = window.__REACT_QUERY_DEVTOOLS__?.queryClient;
    if (queryClient) {
      const cache = queryClient.getQueryCache();
      const conversationQuery = cache.find(['totalConversations']);
      if (conversationQuery) {
        console.log('📊 Total conversations query found in cache:', {
          staleTime: '5 minutes',
          data: conversationQuery.state.data
        });
      }
    }
  } catch (e) {
    // Ignore if React Query DevTools not available
  }
}, 1000);

console.log('🎯 Monitoring active! Send messages to test...');


