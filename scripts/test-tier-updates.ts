#!/usr/bin/env ts-node

/**
 * Tier Update Test Script
 * 
 * This script directly updates the Supabase database to simulate
 * FastSpring webhook events and test the real-time frontend updates.
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

interface TierUpdate {
  tier: 'free' | 'core' | 'studio';
  event: 'subscription.activated' | 'subscription.canceled' | 'subscription.updated';
  description: string;
}

/**
 * Update user tier and log to audit table
 */
async function updateTier(update: TierUpdate): Promise<void> {
  console.log(`\n🚀 ${update.description}...`);
  
  try {
    // Get current tier
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', testUserId)
      .single();
    
    const oldTier = currentProfile?.subscription_tier || 'free';
    const newTier = update.tier;
    
    console.log(`📊 Updating from ${oldTier} → ${newTier}`);
    
    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        subscription_tier: newTier,
        subscription_status: newTier === 'free' ? 'active' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', testUserId);
    
    if (updateError) {
      throw updateError;
    }
    
    // Log to audit table
    const { error: auditError } = await supabase
      .from('subscription_audit')
      .insert({
        profile_id: testUserId,
        event_type: update.event,
        old_tier: oldTier,
        new_tier: newTier,
        provider: 'test',
        metadata: {
          test: true,
          description: update.description,
          timestamp: new Date().toISOString()
        }
      });
    
    if (auditError) {
      console.warn('⚠️ Audit logging failed:', JSON.stringify(auditError, null, 2));
    }
    
    console.log(`✅ Successfully updated to ${newTier}`);
    
  } catch (error) {
    console.error(`❌ Error:`, error);
  }
}

/**
 * Main test function
 */
async function runTests(): Promise<void> {
  console.log('🧪 Atlas Tier Update Test Suite');
  console.log('================================');
  console.log(`👤 Test User: ${testUserId}`);
  console.log(`🎯 Target: Supabase Database`);
  console.log('');

  const tests: TierUpdate[] = [
    { tier: 'core', event: 'subscription.activated', description: 'Activating Core subscription' },
    { tier: 'studio', event: 'subscription.updated', description: 'Upgrading to Studio' },
    { tier: 'core', event: 'subscription.updated', description: 'Downgrading to Core' },
    { tier: 'free', event: 'subscription.canceled', description: 'Cancelling subscription' }
  ];

  for (const test of tests) {
    await updateTier(test);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n🎉 Test suite completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Check Atlas frontend at http://localhost:5175');
  console.log('2. Watch console for real-time updates');
  console.log('3. Verify tier-gated features unlock/lock');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, updateTier };

