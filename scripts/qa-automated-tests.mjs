#!/usr/bin/env node

// Atlas QA Automated Testing Script
// Runs automated tests for tier enforcement, API endpoints, and system health

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const PRODUCTION_URL = 'https://atlas-production-2123.up.railway.app';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 Atlas QA Automated Testing Suite\n');

// Test Results Tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failedTestDetails = [];

function logTest(testName, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ ${testName}`);
  } else {
    failedTests++;
    console.log(`  ❌ ${testName}: ${details}`);
    failedTestDetails.push({ test: testName, details });
  }
}

// Test 1: Production Health Checks
async function testProductionHealth() {
  console.log('🏥 Test 1: Production Health Checks');
  
  try {
    const healthResponse = await fetch(`${PRODUCTION_URL}/healthz`);
    const healthData = await healthResponse.json();
    
    logTest('Health endpoint responds', healthResponse.ok);
    logTest('Health status is ok', healthData.status === 'ok');
    logTest('Tier gate system active', healthData.tierGateSystem === 'active');
    logTest('Version information present', !!healthData.version);
    
    const pingResponse = await fetch(`${PRODUCTION_URL}/ping`);
    const pingData = await pingResponse.json();
    
    logTest('Ping endpoint responds', pingResponse.ok);
    logTest('Ping status is ok', pingData.status === 'ok');
    
  } catch (error) {
    logTest('Production health check', false, error.message);
  }
}

// Test 2: Admin Endpoint Security
async function testAdminSecurity() {
  console.log('\n🔐 Test 2: Admin Endpoint Security');
  
  try {
    // Test without auth token
    const noAuthResponse = await fetch(`${PRODUCTION_URL}/api/admin/metrics`);
    logTest('Admin endpoint blocks unauthorized access', noAuthResponse.status === 401);
    
    // Test with invalid token
    const invalidAuthResponse = await fetch(`${PRODUCTION_URL}/api/admin/metrics`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    logTest('Admin endpoint blocks invalid tokens', invalidAuthResponse.status === 401);
    
    // Test CSV endpoint security
    const csvResponse = await fetch(`${PRODUCTION_URL}/api/admin/snapshots/export.csv`);
    logTest('CSV export endpoint protected', csvResponse.status === 401);
    
    // Test analytics endpoint security
    const analyticsResponse = await fetch(`${PRODUCTION_URL}/api/admin/analytics/summary`);
    logTest('Analytics endpoint protected', analyticsResponse.status === 401);
    
  } catch (error) {
    logTest('Admin security test', false, error.message);
  }
}

// Test 3: Database Schema Validation
async function testDatabaseSchema() {
  console.log('\n🗄️ Test 3: Database Schema Validation');
  
  try {
    // Check tier_budgets table
    const { data: tierBudgets, error: budgetError } = await supabase
      .from('tier_budgets')
      .select('tier, daily_limit, budget_ceiling');
    
    logTest('Tier budgets table accessible', !budgetError);
    logTest('All three tiers configured', tierBudgets?.length === 3);
    
    const freeTier = tierBudgets?.find(t => t.tier === 'free');
    logTest('Free tier: 15 message limit', freeTier?.daily_limit === 15);
    logTest('Free tier: $20 budget ceiling', freeTier?.budget_ceiling === 20);
    
    // Check tier_usage_snapshots table exists
    const { data: snapshots, error: snapshotError } = await supabase
      .from('tier_usage_snapshots')
      .select('id')
      .limit(1);
    
    logTest('Tier usage snapshots table accessible', !snapshotError);
    
    // Check report_runs table exists
    const { data: reports, error: reportError } = await supabase
      .from('report_runs')
      .select('id')
      .limit(1);
    
    logTest('Report runs table accessible', !reportError);
    
    // Test tier enforcement function
    const { data: enforcementTest, error: enforceError } = await supabase
      .rpc('enforce_tier_budget', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_tier: 'free'
      });
    
    // This should fail because user doesn't exist, but function should be callable
    logTest('Tier enforcement function exists', enforceError?.message?.includes('tier_usage') || enforceError?.message?.includes('not found'));
    
  } catch (error) {
    logTest('Database schema validation', false, error.message);
  }
}

// Test 4: Tier System Logic
async function testTierSystemLogic() {
  console.log('\n🎯 Test 4: Tier System Logic');
  
  try {
    // Import tier system functions
    const { selectOptimalModel, estimateRequestCost, TIER_DEFINITIONS } = await import('../backend/config/intelligentTierSystem.mjs');
    
    // Test model selection logic
    const freeModel = selectOptimalModel('free', 'Hello Atlas');
    logTest('Free tier uses Haiku', freeModel === 'claude-3-haiku');
    
    const coreEmotional = selectOptimalModel('core', 'I feel anxious today');
    logTest('Core emotional content uses Sonnet', coreEmotional === 'claude-3-sonnet');
    
    const studioComplex = selectOptimalModel('studio', 'I need a comprehensive analysis of my emotional patterns and long-term strategy for improving my mental health with detailed breakdown');
    logTest('Studio complex content uses Opus', studioComplex === 'claude-3-opus');
    
    // Test cost estimation
    const haikuCost = estimateRequestCost('claude-3-haiku', 1000, 500);
    logTest('Haiku cost estimation works', haikuCost > 0 && haikuCost < 0.01);
    
    const opusCost = estimateRequestCost('claude-3-opus', 1000, 500);
    logTest('Opus more expensive than Haiku', opusCost > haikuCost);
    
    // Test tier definitions
    logTest('Free tier defined correctly', TIER_DEFINITIONS.free.dailyMessages === 15);
    logTest('Core tier unlimited messages', TIER_DEFINITIONS.core.dailyMessages === -1);
    logTest('Studio tier has all models', TIER_DEFINITIONS.studio.models.includes('opus'));
    
  } catch (error) {
    logTest('Tier system logic test', false, error.message);
  }
}

// Test 5: API Response Formats
async function testAPIResponseFormats() {
  console.log('\n📡 Test 5: API Response Formats');
  
  try {
    // Test health endpoint format
    const healthResponse = await fetch(`${PRODUCTION_URL}/healthz`);
    const healthData = await healthResponse.json();
    
    logTest('Health response has required fields', 
      healthData.status && healthData.timestamp && healthData.version);
    
    // Test admin endpoint error format
    const adminResponse = await fetch(`${PRODUCTION_URL}/api/admin/metrics`);
    const adminData = await adminResponse.json();
    
    logTest('Admin error response format correct', 
      adminData.error && adminData.message);
    
    // Test message endpoint error format (without auth)
    const messageResponse = await fetch(`${PRODUCTION_URL}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', tier: 'free' })
    });
    
    logTest('Message endpoint responds', messageResponse.status === 401);
    
  } catch (error) {
    logTest('API response format test', false, error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Atlas QA Automated Testing Suite\n');
  
  await testProductionHealth();
  await testAdminSecurity();
  await testDatabaseSchema();
  await testTierSystemLogic();
  await testAPIResponseFormats();
  
  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 ATLAS QA TESTING RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    failedTestDetails.forEach(failure => {
      console.log(`  • ${failure.test}: ${failure.details}`);
    });
  }
  
  console.log('\n🎯 Launch Readiness:');
  const passRate = (passedTests / totalTests) * 100;
  
  if (passRate >= 95) {
    console.log('🟢 READY FOR LAUNCH - All systems operational!');
  } else if (passRate >= 85) {
    console.log('🟡 LAUNCH WITH MONITORING - Minor issues to track');
  } else if (passRate >= 70) {
    console.log('🟠 DELAY LAUNCH - Critical issues need fixing');
  } else {
    console.log('❌ NOT READY - Major fixes required');
  }
  
  console.log('\n🎊 Atlas QA Testing Complete!');
  
  return {
    totalTests,
    passedTests,
    failedTests,
    passRate,
    failures: failedTestDetails
  };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(results => {
      process.exit(results.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Fatal testing error:', error);
      process.exit(1);
    });
}

export { runAllTests };
