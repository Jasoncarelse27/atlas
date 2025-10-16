// Atlas Tier Refresh Debug Helper
// Run this in browser console to force refresh your tier

(async () => {
  console.log("🔄 Atlas Tier Force Refresh Tool");
  console.log("=====================================");

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

    // Force refresh profile
    console.log("🔄 Force refreshing profile...");
    const freshProfile = await subscriptionApi.forceRefreshProfile(userId, accessToken);

    if (freshProfile) {
      console.log("✅ Fresh Profile Retrieved:");
      console.log("   - Tier:", freshProfile.subscription_tier);
      console.log("   - Status:", freshProfile.subscription_status);
      console.log("   - Email:", freshProfile.email);
      
      // Trigger a page refresh to update the UI
      console.log("🔄 Refreshing page to update UI...");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      console.error("❌ Failed to refresh profile");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
