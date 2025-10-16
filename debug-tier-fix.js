// Atlas Tier Fix Debug Tool
// Run this in browser console to test the tier fix

(async () => {
  console.log("🔧 Atlas Tier Fix Debug Tool");
  console.log("=============================");

  try {
    // Import required modules
    const { supabase } = await import('./src/lib/supabaseClient.ts');
    const { subscriptionApi } = await import('./src/services/subscriptionApi.ts');

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("❌ Session Error:", sessionError);
      return;
    }

    if (!session?.user?.id) {
      console.error("❌ No active session found");
      return;
    }

    const userId = session.user.id;
    const accessToken = session.access_token;

    console.log("👤 User ID:", userId);
    console.log("🔑 Access Token:", accessToken ? "Present" : "Missing");

    // Step 1: Clear all caches
    console.log("🧹 Step 1: Clearing all caches...");
    subscriptionApi.clearUserCache(userId);
    subscriptionApi.clearAllCache();

    // Step 2: Force refresh profile
    console.log("🔄 Step 2: Force refreshing profile...");
    const freshProfile = await subscriptionApi.forceRefreshProfile(userId, accessToken);

    if (freshProfile) {
      console.log("✅ Fresh Profile Retrieved:");
      console.log("   - Tier:", freshProfile.subscription_tier);
      console.log("   - Status:", freshProfile.subscription_status);
      console.log("   - Email:", freshProfile.email);
      
      // Step 3: Check what the UI is currently showing
      console.log("🔍 Step 3: Checking current UI state...");
      const currentTierElements = document.querySelectorAll('[data-testid="tier-display"], .tier-display, [class*="tier"]');
      console.log("   - Found", currentTierElements.length, "tier-related elements");
      
      // Step 4: Trigger a page refresh to update UI
      console.log("🔄 Step 4: Refreshing page to update UI...");
      console.log("   Expected result: Should show 'Atlas Studio' instead of 'Atlas Core'");
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      console.error("❌ Failed to refresh profile");
      console.log("💡 Try running: subscriptionApi.clearAllCache() then refresh manually");
    }

  } catch (error) {
    console.error("❌ Error:", error);
    console.log("💡 Make sure you're on the Atlas app page and try again");
  }
})();
