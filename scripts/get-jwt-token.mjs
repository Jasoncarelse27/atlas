#!/usr/bin/env node
// scripts/get-jwt-token.mjs
// Helper script to get JWT token for testing

console.log(`
🔑 How to Get JWT Token for Testing
====================================

Option 1: Browser Console (Easiest)
------------------------------------
1. Open your Atlas app in browser: https://atlas.otiumcreations.com
2. Open DevTools (F12) → Console tab
3. Run this command:

   import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(async ({ createClient }) => {
     const supabase = createClient(
       '${process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'}',
       '${process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'}'
     );
     const { data: { session } } = await supabase.auth.getSession();
     console.log('\\n✅ JWT Token:', session?.access_token);
     console.log('\\n📋 Copy this token and run:');
     console.log('   export SUPABASE_JWT="' + session?.access_token + '"');
   });

Option 2: Direct from localStorage
-----------------------------------
1. Open DevTools → Application → Local Storage
2. Find key: supabase.auth.token
3. Copy the access_token value from the JSON

Option 3: Use the app's supabase instance
-----------------------------------------
If you're already logged in, run in console:

   // Access the app's supabase instance
   // (This depends on how it's exposed in your app)
   
   // Or use the import method above

Once you have the token, run:
   export SUPABASE_JWT="your_token_here"
   ./scripts/test-agents-dashboard.sh
`);

