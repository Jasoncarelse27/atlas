# 🔑 How to Get JWT Token for Testing

## Quick Method (Browser Console)

Open your Atlas app in browser, then open DevTools Console (F12) and run:

```javascript
// Method 1: If supabase is available in window
if (window.supabase) {
  const { data: { session } } = await window.supabase.auth.getSession();
  console.log('✅ JWT:', session?.access_token);
  copy(session?.access_token); // Copies to clipboard
}

// Method 2: Import Supabase client directly
import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(async ({ createClient }) => {
  const supabase = createClient(
    'https://rbwabemtucdkytvvpzvk.supabase.co', // Your Supabase URL
    'YOUR_ANON_KEY_HERE' // Get from .env or Vercel
  );
  const { data: { session } } = await supabase.auth.getSession();
  console.log('✅ JWT Token:', session?.access_token);
  console.log('\n📋 Run this command:');
  console.log(`export SUPABASE_JWT="${session?.access_token}"`);
});

// Method 3: Get from localStorage (if already logged in)
const authData = localStorage.getItem('sb-rbwabemtucdkytvvpzvk-auth-token');
if (authData) {
  const parsed = JSON.parse(authData);
  console.log('✅ JWT:', parsed.access_token);
  copy(parsed.access_token);
}
```

## Once You Have the Token

```bash
export SUPABASE_JWT="your_token_here"
./scripts/test-agents-dashboard.sh
```

