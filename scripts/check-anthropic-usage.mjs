#!/usr/bin/env node
/**
 * Check which Anthropic API key is configured and verify it's being used
 * 
 * Usage: node scripts/check-anthropic-usage.mjs
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in environment');
  process.exit(1);
}

// Show first 8 characters to identify which key
const keyPrefix = ANTHROPIC_API_KEY.substring(0, 8);
const keyLength = ANTHROPIC_API_KEY.length;

console.log('🔍 Anthropic API Key Check');
console.log('========================');
console.log(`Key Prefix: ${keyPrefix}...`);
console.log(`Key Length: ${keyLength} characters`);
console.log('');

// Match against known keys from screenshot
const knownKeys = {
  'sk-ant-7': 'jason carelse-on... (old key)',
  'sk-ant-QN': 'atlas-anthropic-api (Last Used: Nov 1, Cost: $0.68)',
  'sk-ant-3D': 'myappapiatlas (unused)',
  'sk-ant-XY': 'atlas-production... (Last Used: Nov 7, Cost: $0.01)',
  'sk-ant-5y': 'atlas-production... (Never used)',
};

const matchedKey = Object.entries(knownKeys).find(([prefix]) => 
  ANTHROPIC_API_KEY.startsWith(prefix)
);

if (matchedKey) {
  console.log(`✅ Matched Key: ${matchedKey[1]}`);
} else {
  console.log('⚠️  Key prefix not recognized - might be a different key');
}

console.log('');
console.log('📋 To verify usage:');
console.log('1. Go to: https://console.anthropic.com/settings/keys');
console.log('2. Find the key starting with:', keyPrefix);
console.log('3. Check "LAST USED AT" column');
console.log('');
console.log('🔍 To check Railway logs:');
console.log('1. Go to: https://railway.app/project/atlas-production-2123/logs');
console.log('2. Look for: "[Server] API Keys loaded: ANTHROPIC_API_KEY: ✅ Set (...)"');
console.log('3. Look for API call logs: "[streamAnthropicResponse]" or "[Message]"');

