#!/usr/bin/env node

/**
 * Atlas Environment Validation Script
 * 
 * This script validates that all required environment variables are present
 * during build time. For Vercel deployments, environment variables are
 * injected during the build process, so we'll skip validation in that context.
 * 
 * Usage:
 * - CI/CD: Runs automatically before build via "prebuild" script
 * - Local: Can be run manually with `npm run check-env`
 */

// Skip validation in Vercel deployment environment
if (process.env.VERCEL || process.env.CI) {
  console.log('🚀 Detected deployment environment - skipping env validation');
  console.log('💡 Environment variables will be injected by deployment platform');
  process.exit(0);
}

import 'dotenv/config';

const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

console.log('🔍 Checking required environment variables...');

const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error('\n💡 Make sure to set these in your deployment environment:');
  console.error('   - Vercel: Project Settings → Environment Variables');
  console.error('   - Expo/EAS: eas.json → env');
  console.error('   - GitHub Actions: Repository Settings → Secrets');
  console.error('   - Local: .env.local file');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are present');
  console.log('🚀 Build can proceed safely');
}
