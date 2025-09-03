#!/usr/bin/env node

/**
 * 🔍 Atlas AI Setup Verification Script
 * Ensures Atlas AI is properly configured and Nova is completely removed
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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
  log(`🔍 ${message}`, 'blue');
}

console.log('\n🚀 Atlas AI Setup Verification\n' + '='.repeat(50));

let allChecksPassed = true;

// Check 1: main.tsx imports App
try {
  const mainTsx = readFileSync('src/main.tsx', 'utf8');
  if (mainTsx.includes("import AtlasApp from './App'")) {
    logSuccess('main.tsx correctly imports ./App');
  } else {
    logError('main.tsx does not import ./App');
    allChecksPassed = false;
  }
} catch (error) {
  logError('Could not read src/main.tsx');
  allChecksPassed = false;
}

// Check 2: index.html has Atlas branding
try {
  const indexHtml = readFileSync('index.html', 'utf8');
  if (indexHtml.includes('Atlas AI') && !indexHtml.includes('Nova')) {
    logSuccess('index.html has Atlas AI branding, no Nova references');
  } else {
    logError('index.html has Nova references or missing Atlas branding');
    allChecksPassed = false;
  }
} catch (error) {
  logError('Could not read index.html');
  allChecksPassed = false;
}

// Check 3: Nova components are archived
if (existsSync('legacy/atlas_ai_brain_app.tsx')) {
  logSuccess('Nova component archived in legacy/ folder');
} else {
  logWarning('Nova component not found in legacy/ folder');
}

if (existsSync('legacy/index-nova-old.html')) {
  logSuccess('Old Nova HTML archived in legacy/ folder');
} else {
  logWarning('Old Nova HTML not found in legacy/ folder');
}

// Check 4: Ports are available
try {
  const port8000 = execSync('lsof -i :8000', { encoding: 'utf8' });
  if (port8000.includes('LISTEN')) {
    logSuccess('Port 8000 (backend) is active');
  } else {
    logError('Port 8000 (backend) is not active');
    allChecksPassed = false;
  }
} catch (error) {
  logError('Port 8000 (backend) is not active');
  allChecksPassed = false;
}

try {
  const port5173 = execSync('lsof -i :5173', { encoding: 'utf8' });
  if (port5173.includes('LISTEN')) {
    logSuccess('Port 5173 (frontend) is active');
  } else {
    logError('Port 5173 (frontend) is not active');
    allChecksPassed = false;
  }
} catch (error) {
  logError('Port 5173 (frontend) is not active');
  allChecksPassed = false;
}

// Check 5: Service layer files exist
const serviceFiles = [
  'src/services/chatService.ts',
  'src/services/atlasAIService.ts',
  'src/services/conversationService.ts',
  'src/services/localMessageStore.ts',
  'src/context/SafeModeContext.tsx'
];

serviceFiles.forEach(file => {
  if (existsSync(file)) {
    logSuccess(`${file} exists`);
  } else {
    logError(`${file} missing`);
    allChecksPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allChecksPassed) {
  logSuccess('🎉 All Atlas AI setup checks passed!');
  console.log('\n🌐 Visit: http://localhost:5173');
  console.log('🔗 Backend: http://localhost:8000/healthz');
  console.log('\n🧪 Test in browser console:');
  console.log('  testChatService.runAllTests()');
} else {
  logError('❌ Some checks failed. Please review the errors above.');
}

console.log('\n📋 Next Steps:');
console.log('  1. Open http://localhost:5173 in browser');
console.log('  2. Verify Atlas AI header with SafeMode toggle');
console.log('  3. Test service layer with console commands');
console.log('  4. Check IndexedDB for AtlasLocalMessages');
