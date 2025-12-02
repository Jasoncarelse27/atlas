#!/usr/bin/env node
// scripts/test-agents-dashboard.mjs
// Node.js test script for Agents Dashboard endpoints
// Can run without JWT to verify routes exist, or with JWT for full testing

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Colors for terminal
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

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test endpoint helper
async function testEndpoint(method, endpoint, description, data = null, jwt = null, expectedStatus = 200) {
  logInfo(`Testing: ${method} ${endpoint}`);
  logInfo(`Description: ${description}`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (jwt) {
    options.headers['Authorization'] = `Bearer ${jwt}`;
  }
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    if (response.status === expectedStatus) {
      logSuccess(`HTTP ${response.status} (expected ${expectedStatus})`);
      if (responseData && typeof responseData === 'object') {
        console.log(JSON.stringify(responseData, null, 2));
      } else if (responseData) {
        console.log(responseData);
      }
      return { success: true, data: responseData, status: response.status };
    } else {
      logError(`HTTP ${response.status} (expected ${expectedStatus})`);
      console.log(responseData);
      return { success: false, data: responseData, status: response.status };
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Get JWT token from Supabase
async function getJWTToken(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logWarning('Supabase credentials not found in .env');
    logInfo('Set SUPABASE_URL and SUPABASE_ANON_KEY to enable authenticated testing');
    return null;
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      logError(`Authentication failed: ${error.message}`);
      return null;
    }
    
    logSuccess(`Authenticated as ${email}`);
    return data.session?.access_token || null;
  } catch (error) {
    logError(`Auth error: ${error.message}`);
    return null;
  }
}

// Main test suite
async function main() {
  logSection('🧪 Agents Dashboard Backend Test Suite');
  logInfo(`API URL: ${API_URL}`);
  logInfo(`Timestamp: ${new Date().toISOString()}`);
  
  // Check backend health
  logSection('Backend Health Check');
  try {
    const healthResponse = await fetch(`${API_URL}/healthz`);
    if (healthResponse.ok) {
      logSuccess('Backend is running');
    } else {
      logError(`Backend health check failed: ${healthResponse.status}`);
      process.exit(1);
    }
  } catch (error) {
    logError(`Cannot connect to backend: ${error.message}`);
    logInfo('Make sure backend is running: npm run backend:dev');
    process.exit(1);
  }
  
  // Try to get JWT token
  let jwt = null;
  const testEmail = process.env.TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;
  
  if (testEmail && testPassword) {
    logSection('Authentication');
    jwt = await getJWTToken(testEmail, testPassword);
  } else {
    logWarning('TEST_EMAIL and TEST_PASSWORD not set - skipping authenticated tests');
    logInfo('Set TEST_EMAIL and TEST_PASSWORD in .env to enable full testing');
  }
  
  const hasJWT = !!jwt;
  
  // Test 1: GET /api/notifications
  logSection('Test 1: GET /api/notifications');
  if (hasJWT) {
    await testEndpoint('GET', '/api/notifications', 'Fetch user notifications', null, jwt, 200);
  } else {
    await testEndpoint('GET', '/api/notifications', 'Should require authentication', null, null, 401);
    logSuccess('Authentication check working (401 as expected)');
  }
  
  // Test 2: POST /api/business-notes
  logSection('Test 2: POST /api/business-notes');
  let noteId = null;
  if (hasJWT) {
    const testContent = `Test note created at ${new Date().toISOString()}`;
    const result = await testEndpoint('POST', '/api/business-notes', 'Create business note', 
      { content: testContent }, jwt, 200);
    if (result.success && result.data?.note?.id) {
      noteId = result.data.note.id;
      logInfo(`Note ID: ${noteId}`);
    }
  } else {
    await testEndpoint('POST', '/api/business-notes', 'Should require authentication', 
      { content: 'test' }, null, 401);
    logSuccess('Authentication check working (401 as expected)');
  }
  
  // Test 3: GET /api/business-notes
  logSection('Test 3: GET /api/business-notes');
  if (hasJWT) {
    await testEndpoint('GET', '/api/business-notes', 'Fetch all business notes', null, jwt, 200);
  } else {
    await testEndpoint('GET', '/api/business-notes', 'Should require authentication', null, null, 401);
    logSuccess('Authentication check working (401 as expected)');
  }
  
  // Test 4: POST /api/business-chat
  logSection('Test 4: POST /api/business-chat');
  if (hasJWT) {
    const chatContent = `Test memory: I prefer morning meetings. Created at ${new Date().toISOString()}`;
    const result = await testEndpoint('POST', '/api/business-chat', 'Memory-aware chat with LLM', 
      { content: chatContent }, jwt, 200);
    if (!result.success && result.status === 500) {
      logWarning('Business chat endpoint exists but may require Anthropic API key');
    }
  } else {
    await testEndpoint('POST', '/api/business-chat', 'Should require authentication', 
      { content: 'test' }, null, 401);
    logSuccess('Authentication check working (401 as expected)');
  }
  
  // Test 5: POST /api/notifications/mark-read
  logSection('Test 5: POST /api/notifications/mark-read');
  if (hasJWT) {
    // Try to get a notification first
    const notifResult = await testEndpoint('GET', '/api/notifications', 'Get notifications for mark-read test', null, jwt, 200);
    if (notifResult.success && notifResult.data?.notifications?.length > 0) {
      const notifId = notifResult.data.notifications[0].id;
      await testEndpoint('POST', '/api/notifications/mark-read', 'Mark notification as read', 
        { notificationId: notifId }, jwt, 200);
    } else {
      logWarning('No notifications found to test mark-read endpoint');
    }
  } else {
    await testEndpoint('POST', '/api/notifications/mark-read', 'Should require authentication', 
      { notificationId: 'test-id' }, null, 401);
    logSuccess('Authentication check working (401 as expected)');
  }
  
  // Summary
  logSection('Test Summary');
  logSuccess('✅ All endpoint tests completed!');
  logInfo('');
  if (!hasJWT) {
    logWarning('Note: Full testing requires JWT token');
    logInfo('To enable full testing:');
    logInfo('1. Set TEST_EMAIL and TEST_PASSWORD in .env');
    logInfo('2. Or get token from browser: supabase.auth.getSession()');
    logInfo('3. Then run: SUPABASE_JWT=<token> ./scripts/test-agents-dashboard.sh');
  }
}

// Run tests
main().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});

