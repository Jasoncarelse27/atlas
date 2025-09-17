#!/usr/bin/env node

/**
 * Atlas Environment Validation Script
 * 
 * This script validates that all required environment variables are present
 * during build time. It's designed to fail CI/CD builds if critical env vars
 * are missing, while allowing local development to continue with fallback UI.
 * 
 * Usage:
 * - CI/CD: Runs automatically before build via "prebuild" script
 * - Local: Can be run manually with `npm run check-env`
 */

// Load environment variables from .env.local for local development
try {
  const { config } = await import('dotenv');
  const result = config({ path: '.env.local' });
  if (result.error) {
    console.log('⚠️  Could not load .env.local:', result.error.message);
  } else if (result.parsed) {
    console.log('📁 Loaded .env.local file with', Object.keys(result.parsed).length, 'variables');
  }
} catch (error) {
  console.log('⚠️  dotenv not available or .env.local doesn\'t exist:', error.message);
}

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

let missing = [];

console.log('🔍 Checking required environment variables...');

for (const key of required) {
  if (!process.env[key]) {
    missing.push(key);
  } else {
    console.log(`✅ ${key}: ${process.env[key].substring(0, 20)}...`);
  }
}

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => {
    console.error(`   - ${key}`);
  });
  console.error('\n💡 Make sure to set these in your deployment environment:');
  console.error('   - Vercel: Project Settings → Environment Variables');
  console.error('   - Expo/EAS: eas.json → env');
  console.error('   - GitHub Actions: Repository Settings → Secrets');
  console.error('   - Local: .env.local file');
  process.exit(1); // fail build
} else {
  console.log('✅ All required environment variables are present');
  console.log('🚀 Build can proceed safely');
}
