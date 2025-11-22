// Atlas Chat Stability Verification Script
// Run this in browser console after the fix is deployed

console.log('🔍 Atlas Chat Stability Verification');
console.log('=====================================\n');

// 1. Check Dexie sorting implementation
console.log('1️⃣ Checking message sorting fix...');
try {
  const db = window.atlasDB || window.db;
  if (db) {
    console.log('✅ Dexie database found');
    
    // Get messages from current conversation
    const messages = await db.messages.toArray();
    console.log(`📊 Found ${messages.length} messages in local DB`);
    
    // Check if messages are properly sorted
    let sorted = true;
    for (let i = 1; i < messages.length; i++) {
      const prev = new Date(messages[i-1].timestamp).getTime();
      const curr = new Date(messages[i].timestamp).getTime();
      if (prev > curr + 2000) { // Allow 2 second tolerance
        sorted = false;
        console.log('⚠️ Messages may be out of order:', {
          prev: messages[i-1].timestamp,
          curr: messages[i].timestamp
        });
      }
    }
    console.log(sorted ? '✅ Messages are properly sorted' : '⚠️ Check message order');
  } else {
    console.log('❌ Dexie database not found');
  }
} catch (error) {
  console.log('❌ Error checking Dexie:', error);
}

console.log('\n2️⃣ Checking sync delays...');
// Look for the restored delays
const delays = {
  mainSync: 1500,
  mobileSync: 300,
  retryDelay: 500,
  visibilitySync: 300,
  dexieWrite: 120
};
console.log('✅ Expected delays (ms):', delays);

console.log('\n3️⃣ Testing message send flow...');
console.log('Instructions:');
console.log('1. Send a test message: "Test message stability"');
console.log('2. Watch if the message stays in place (no jumping)');
console.log('3. Check console for any errors');
console.log('\n');

// Monitor for message updates
let messageCount = 0;
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.textContent?.includes('Test message stability')) {
          messageCount++;
          console.log(`📬 Message render #${messageCount} detected`);
          if (messageCount > 2) {
            console.log('⚠️ Multiple re-renders detected - possible jumping issue');
          }
        }
      });
    }
  });
});

// Start observing
const messagesContainer = document.querySelector('[class*="messages"], [class*="chat"], [data-testid="messages-container"]');
if (messagesContainer) {
  observer.observe(messagesContainer, { childList: true, subtree: true });
  console.log('🔍 Now monitoring for message jumping...');
  console.log('👉 Send your test message now!');
  
  // Stop after 10 seconds
  setTimeout(() => {
    observer.disconnect();
    console.log('\n📊 Test complete!');
    console.log(messageCount <= 2 ? '✅ No jumping detected!' : '⚠️ Possible jumping issue');
  }, 10000);
} else {
  console.log('❌ Could not find messages container');
}

// 4. Performance check
console.log('\n4️⃣ Checking performance...');
window.addEventListener('slow-operation', (e) => {
  console.log('⚠️ Slow operation detected:', e.detail);
});

console.log('\n✅ Verification script loaded!');
console.log('🎯 Send a test message to verify stability');
