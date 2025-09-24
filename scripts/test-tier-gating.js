#!/usr/bin/env node

/**
 * Atlas Tier Gating Test Script
 * Quick validation of tier gating functionality
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testTierGating() {
  console.log('🧪 Atlas Tier Gating Test');
  console.log('=========================');
  console.log('');

  try {
    // Test 1: Check if test users exist
    console.log('🔍 Checking test users...');
    const testEmails = ['free_tester@atlas.app', 'core_tester@atlas.app', 'studio_tester@atlas.app'];
    
    for (const email of testEmails) {
      const { data: userData, error } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email === email);
      
      if (error) {
        console.log(`   ❌ ${email}: ${error.message}`);
      } else if (user) {
        // Check profile tier
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.log(`   ⚠️  ${email}: User exists but no profile found`);
        } else {
          const expectedTier = email.split('_')[0]; // free, core, studio
          const actualTier = profile.subscription_tier;
          const status = expectedTier === actualTier ? '✅' : '❌';
          console.log(`   ${status} ${email}: ${actualTier} tier`);
        }
      } else {
        console.log(`   ⚠️  ${email}: Not found`);
      }
    }

    console.log('');

    // Test 2: Check backend health
    console.log('🔍 Checking backend health...');
    try {
      const response = await fetch('http://localhost:3000/ping');
      if (response.ok) {
        console.log('   ✅ Backend is running and responding');
      } else {
        console.log(`   ❌ Backend returned status: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Backend not accessible: ${error.message}`);
    }

    console.log('');

    // Test 3: Check admin API
    console.log('🔍 Checking admin API...');
    try {
      const response = await fetch('http://localhost:3000/admin/metrics');
      if (response.ok) {
        console.log('   ✅ Admin API is accessible');
      } else {
        console.log(`   ⚠️  Admin API returned status: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Admin API not accessible: ${error.message}`);
    }

    console.log('');
    console.log('🎯 Test Summary:');
    console.log('   • Check test users above for tier validation');
    console.log('   • Backend should be running for full testing');
    console.log('   • Use the Atlas app to test feature gating');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Run: node scripts/seed-test-users.js (if users missing)');
    console.log('   2. Test each tier in the Atlas app');
    console.log('   3. Verify upgrade modals appear for restricted features');

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTierGating().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
