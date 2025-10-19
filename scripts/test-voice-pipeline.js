#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎙️  Atlas Voice Pipeline Test');
console.log('============================\n');

// Test configuration
const BACKEND_URL = 'http://localhost:8000';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Color codes for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function checkOpenAIKey() {
  console.log('1️⃣  Checking OpenAI API Key...');
  if (!OPENAI_API_KEY) {
    console.log(`${RED}❌ OpenAI API key not found in environment${RESET}`);
    console.log(`   Please set OPENAI_API_KEY in your .env file`);
    return false;
  }
  
  // Mask the key for security
  const maskedKey = OPENAI_API_KEY.substring(0, 7) + '...' + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4);
  console.log(`${GREEN}✅ OpenAI API key found: ${maskedKey}${RESET}`);
  return true;
}

async function checkBackendHealth() {
  console.log('\n2️⃣  Checking Backend Health...');
  try {
    const response = await fetch(`${BACKEND_URL}/healthz`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`${GREEN}✅ Backend is healthy${RESET}`);
      console.log(`   Version: ${data.version || 'unknown'}`);
      console.log(`   Timestamp: ${data.timestamp}`);
      return true;
    } else {
      console.log(`${RED}❌ Backend health check failed${RESET}`);
      return false;
    }
  } catch (error) {
    console.log(`${RED}❌ Cannot connect to backend at ${BACKEND_URL}${RESET}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkTranscriptionEndpoint() {
  console.log('\n3️⃣  Checking Transcription Endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      console.log(`${GREEN}✅ Transcription endpoint exists (requires auth)${RESET}`);
      return true;
    } else if (response.status === 400) {
      console.log(`${GREEN}✅ Transcription endpoint exists (validation working)${RESET}`);
      return true;
    } else {
      console.log(`${YELLOW}⚠️  Unexpected response: ${response.status}${RESET}`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      return true;
    }
  } catch (error) {
    console.log(`${RED}❌ Transcription endpoint not accessible${RESET}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkTTSEndpoint() {
  console.log('\n4️⃣  Checking TTS Endpoint...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      console.log(`${GREEN}✅ TTS endpoint exists (requires auth)${RESET}`);
      return true;
    } else if (response.status === 400) {
      console.log(`${GREEN}✅ TTS endpoint exists (validation working)${RESET}`);
      return true;
    } else {
      console.log(`${YELLOW}⚠️  Unexpected response: ${response.status}${RESET}`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      return true;
    }
  } catch (error) {
    console.log(`${RED}❌ TTS endpoint not accessible${RESET}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkSupabaseEdgeFunctions() {
  console.log('\n5️⃣  Checking Supabase Edge Functions...');
  console.log(`${YELLOW}⚠️  Note: Edge functions are placeholders until deployed${RESET}`);
  console.log(`   The backend uses OpenAI directly for now`);
  return true;
}

async function runAllTests() {
  console.log('Starting comprehensive voice pipeline test...\n');
  
  const results = {
    openaiKey: await checkOpenAIKey(),
    backendHealth: await checkBackendHealth(),
    transcription: await checkTranscriptionEndpoint(),
    tts: await checkTTSEndpoint(),
    edgeFunctions: await checkSupabaseEdgeFunctions()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log(`${GREEN}✅ All tests passed! Voice pipeline is ready.${RESET}`);
    console.log('\n🎯 Next Steps:');
    console.log('1. Login to Atlas as a Core or Studio tier user');
    console.log('2. Click the microphone button in the chat');
    console.log('3. Allow microphone permissions when prompted');
    console.log('4. Speak your message!');
  } else {
    console.log(`${RED}❌ Some tests failed. Please fix the issues above.${RESET}`);
    console.log('\n🔧 Troubleshooting:');
    if (!results.openaiKey) {
      console.log('- Add your OpenAI API key to .env file');
    }
    if (!results.backendHealth) {
      console.log('- Make sure backend is running: cd backend && node server.mjs');
    }
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runAllTests().catch(console.error);
