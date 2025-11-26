#!/usr/bin/env node
/**
 * CORS Validation Script
 * Tests CORS configuration for Atlas backend API
 * 
 * Usage: node scripts/test-cors.js [backend-url]
 * Example: node scripts/test-cors.js https://atlas-production-2123.up.railway.app
 */

import https from 'https';
import http from 'http';

// Default backend URL (update if needed)
const DEFAULT_BACKEND_URL = process.env.BACKEND_URL || 'https://atlas-production-2123.up.railway.app';
const BACKEND_URL = process.argv[2] || DEFAULT_BACKEND_URL;

// Test origins
const TEST_ORIGINS = [
  'https://atlas.otiumcreations.com',
  'https://atlas-xi-tawny.vercel.app',
  'http://localhost:5174',
  'https://invalid-origin.com' // Should be rejected
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testCORS(origin, shouldAllow = true) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Testing origin: ${origin}`, 'blue');
  log(`Expected: ${shouldAllow ? 'ALLOWED' : 'BLOCKED'}`, shouldAllow ? 'green' : 'yellow');
  
  try {
    // Test OPTIONS preflight request
    log('\n📤 Testing OPTIONS preflight...', 'cyan');
    const optionsResponse = await makeRequest(`${BACKEND_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    
    const acao = optionsResponse.headers['access-control-allow-origin'];
    const acam = optionsResponse.headers['access-control-allow-methods'];
    const acah = optionsResponse.headers['access-control-allow-headers'];
    
    log(`  Status: ${optionsResponse.statusCode}`, optionsResponse.statusCode === 200 ? 'green' : 'red');
    log(`  Access-Control-Allow-Origin: ${acao || 'NOT SET'}`, acao ? 'green' : 'red');
    log(`  Access-Control-Allow-Methods: ${acam || 'NOT SET'}`, acam ? 'green' : 'yellow');
    log(`  Access-Control-Allow-Headers: ${acah || 'NOT SET'}`, acah ? 'green' : 'yellow');
    
    // Test actual GET request
    log('\n📤 Testing GET request...', 'cyan');
    const getResponse = await makeRequest(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': origin
      }
    });
    
    const getAcao = getResponse.headers['access-control-allow-origin'];
    
    log(`  Status: ${getResponse.statusCode}`, getResponse.statusCode === 200 ? 'green' : 'red');
    log(`  Access-Control-Allow-Origin: ${getAcao || 'NOT SET'}`, getAcao ? 'green' : 'red');
    
    // Validate results
    const isAllowed = acao === origin || acao === '*';
    const matchesExpected = (shouldAllow && isAllowed) || (!shouldAllow && !isAllowed);
    
    if (matchesExpected) {
      log(`\n✅ PASS: Origin ${shouldAllow ? 'correctly allowed' : 'correctly blocked'}`, 'green');
      return true;
    } else {
      log(`\n❌ FAIL: Origin ${shouldAllow ? 'should be allowed but was blocked' : 'should be blocked but was allowed'}`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('\n🚀 Atlas CORS Validation Test', 'cyan');
  log(`Backend URL: ${BACKEND_URL}`, 'blue');
  log(`${'='.repeat(60)}\n`, 'cyan');
  
  const results = [];
  
  // Test valid origins (should be allowed)
  for (const origin of TEST_ORIGINS.slice(0, -1)) {
    const result = await testCORS(origin, true);
    results.push({ origin, expected: 'allowed', passed: result });
  }
  
  // Test invalid origin (should be blocked)
  const invalidResult = await testCORS(TEST_ORIGINS[TEST_ORIGINS.length - 1], false);
  results.push({ 
    origin: TEST_ORIGINS[TEST_ORIGINS.length - 1], 
    expected: 'blocked', 
    passed: invalidResult 
  });
  
  // Summary
  log(`\n${'='.repeat(60)}`, 'cyan');
  log('📊 Test Summary', 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`${status} - ${result.origin} (expected: ${result.expected})`, color);
  });
  
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Total: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n🎉 All CORS tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some CORS tests failed. Please check your backend configuration.', 'yellow');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

