#!/usr/bin/env ts-node

/**
 * Real-time Updates Test Script
 * 
 * This script triggers tier changes and provides instructions
 * for monitoring real-time updates in the Atlas frontend.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user ID
const testUserId = "65fcb50a-d67d-453e-a405-50c6aef959be";

/**
 * Update user tier with detailed logging
 */
async function updateTier(tier: 'free' | 'core' | 'studio', description: string): Promise<void> {
  console.log(`\n🚀 ${description}...`);
  
  try {
    // Get current tier
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', testUserId)
      .single();
    
    const oldTier = currentProfile?.subscription_tier || 'free';
    
    console.log(`📊 Current tier: ${oldTier}`);
    console.log(`📊 New tier: ${tier}`);
    
    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        subscription_tier: tier,
        subscription_status: tier === 'free' ? 'active' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', testUserId);
    
    if (updateError) {
      throw updateError;
    }
    
    console.log(`✅ Successfully updated to ${tier}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Main test function
 */
async function runRealtimeTest(): Promise<void> {
  console.log('🧪 Atlas Real-time Updates Test');
  console.log('================================');
  console.log(`👤 Test User: ${testUserId}`);
  console.log(`🌐 Frontend: http://localhost:5175`);
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. Open Atlas frontend in browser');
  console.log('2. Open browser DevTools (F12)');
  console.log('3. Go to Console tab');
  console.log('4. Watch for real-time update messages');
  console.log('5. Look for tier-gated features to unlock/lock');
  console.log('');
  console.log('🔍 Expected console messages:');
  console.log('✅ "[useTierAccess] Setting up real-time subscription listener"');
  console.log('🔄 "[useTierAccess] Real-time profile update received"');
  console.log('📊 "Tier changed from X to Y"');
  console.log('');
  
  // Wait for user to open browser
  console.log('⏳ Waiting 10 seconds for you to open the browser...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const tests = [
    { tier: 'core' as const, description: 'Activating Core subscription' },
    { tier: 'studio' as const, description: 'Upgrading to Studio' },
    { tier: 'core' as const, description: 'Downgrading to Core' },
    { tier: 'free' as const, description: 'Cancelling subscription' }
  ];

  for (const test of tests) {
    await updateTier(test.tier, test.description);
    
    console.log(`\n👀 Check the browser console for real-time updates!`);
    console.log(`🎯 Look for tier-gated features (mic, image, studio features)`);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 8000));
  }

  console.log('\n🎉 Real-time test completed!');
  console.log('\n📋 Verification checklist:');
  console.log('✅ No 401 errors in console (JWT fix works)');
  console.log('✅ Real-time subscription listener active');
  console.log('✅ Tier changes reflected instantly');
  console.log('✅ Tier-gated features unlock/lock correctly');
  console.log('✅ No page refresh required');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealtimeTest().catch(console.error);
}

export { runRealtimeTest, updateTier };

