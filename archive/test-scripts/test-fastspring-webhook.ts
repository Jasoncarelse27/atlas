#!/usr/bin/env ts-node

/**
 * FastSpring Webhook Test Script
 * 
 * This script simulates FastSpring webhook events to test subscription
 * activation, update, cancellation, and deactivation without relying
 * on the FastSpring dashboard.
 */

import fetch from 'node-fetch';

// Configuration
const baseUrl = process.env.RAILWAY_URL || "http://localhost:3000";
const webhookUrl = `${baseUrl}/api/fastspring-webhook`;

// Test user ID - replace with a real user ID from your Supabase
const testUserId = "65fcb50a-d67d-453e-a405-50c6aef959be"; // Replace with actual user ID

interface TestEvent {
  id: string;
  event: string;
  data: {
    userId: string;
    subscription: {
      id: string;
      status: string;
      plan: string;
    };
  };
}

/**
 * Send a test event to the FastSpring webhook
 */
async function sendTestEvent(event: string, userId: string, plan: string = 'core'): Promise<void> {
  const payload: TestEvent = {
    id: `test-${Date.now()}`,
    event,
    data: {
      userId,
      subscription: {
        id: `sub_test_${Date.now()}`,
        status: event.includes("canceled") || event.includes("deactivated") ? "canceled" : "active",
        plan: plan
      }
    }
  };

  console.log(`\n🚀 Sending ${event} event...`);
  console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`✅ Success (${response.status}):`, responseText);
    } else {
      console.log(`❌ Error (${response.status}):`, responseText);
    }
  } catch (error) {
    console.error(`💥 Network error:`, error);
  }
}

/**
 * Main test function
 */
async function runTests(): Promise<void> {
  console.log('🧪 FastSpring Webhook Test Suite');
  console.log('================================');
  console.log(`🎯 Target: ${webhookUrl}`);
  console.log(`👤 Test User: ${testUserId}`);
  console.log('');

  // Test sequence
  const tests = [
    { event: "subscription.activated", plan: "atlas-core" },
    { event: "subscription.updated", plan: "atlas-studio" },
    { event: "subscription.canceled", plan: "atlas-studio" },
    { event: "subscription.deactivated", plan: "atlas-studio" }
  ];

  for (const test of tests) {
    await sendTestEvent(test.event, testUserId, test.plan);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n🎉 Test suite completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Check Supabase profiles table for tier updates');
  console.log('2. Check subscription_audit table for event logging');
  console.log('3. Verify Atlas frontend reflects tier changes');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, sendTestEvent };
