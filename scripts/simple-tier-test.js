#!/usr/bin/env node

/**
 * Simple Atlas Tier Gating Test
 * Quick validation using direct database queries
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
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testTierGating() {
  console.log('🧪 Atlas Tier Gating Test');
  console.log('=========================');
  console.log('');

  try {
    // Test 1: Check current user profile
    console.log('🔍 Checking current user profile...');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('email, subscription_tier, subscription_status')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (profileError) {
      console.log(`   ❌ Profile query failed: ${profileError.message}`);
    } else {
      console.log('   📊 Recent profiles:');
      profiles.forEach(profile => {
        console.log(`      • ${profile.email}: ${profile.subscription_tier} (${profile.subscription_status})`);
      });
    }

    console.log('');

    // Test 2: Check backend health
    console.log('🔍 Checking backend health...');
    try {
      const response = await fetch('http://localhost:3000/ping');
      if (response.ok) {
        const data = await response.text();
        console.log('   ✅ Backend is running and responding');
        console.log(`   📡 Response: ${data}`);
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
        const data = await response.json();
        console.log('   ✅ Admin API is accessible');
        console.log(`   📊 Feature attempts: ${data.feature_attempts?.length || 0}`);
      } else {
        console.log(`   ⚠️  Admin API returned status: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Admin API not accessible: ${error.message}`);
    }

    console.log('');
    console.log('🎯 Test Summary:');
    console.log('   • Check profiles above for current tier distribution');
    console.log('   • Backend should be running for full testing');
    console.log('   • Use the Atlas app to test feature gating');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Test each tier in the Atlas app');
    console.log('   2. Verify upgrade modals appear for restricted features');
    console.log('   3. Check console for "🔓 DEV MODE" bypass messages (should be none)');

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
