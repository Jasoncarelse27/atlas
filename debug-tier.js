// Debug script to check tier status
// Run this in browser console to debug tier issues

console.log('🔍 Atlas Tier Debug Helper');
console.log('========================');

// Check if subscriptionApi is available
if (typeof subscriptionApi !== 'undefined') {
  console.log('✅ subscriptionApi found');
  
  // Clear cache
  subscriptionApi.clearCache();
  console.log('🧹 Cache cleared');
  
  // Get current user
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      console.log('👤 User ID:', user.id);
      
      // Get tier
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          subscriptionApi.getUserTier(user.id, session.access_token)
            .then(tier => {
              console.log('🎯 Current Tier:', tier);
              console.log('📊 Expected: studio (from Supabase)');
              
              if (tier === 'studio') {
                console.log('✅ Camera should work!');
              } else {
                console.log('❌ Camera blocked - tier is', tier);
              }
            })
            .catch(err => console.error('❌ Tier fetch failed:', err));
        }
      });
    } else {
      console.log('❌ No user logged in');
    }
  });
} else {
  console.log('❌ subscriptionApi not found - reload the page');
}

console.log('');
console.log('💡 To force refresh:');
console.log('1. subscriptionApi.clearCache()');
console.log('2. window.location.reload()');
