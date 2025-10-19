#!/usr/bin/env node

/**
 * Redis Cache Testing Script
 * Verifies Redis connection and caching functionality
 */

import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function testRedis() {
  console.log('🔍 Testing Redis connection...\n');
  
  const client = createClient({ url: REDIS_URL });
  
  try {
    // Connect to Redis
    client.on('error', err => console.error('Redis Client Error:', err));
    await client.connect();
    console.log('✅ Connected to Redis');
    
    // Test 1: Basic operations
    console.log('\n📝 Test 1: Basic operations');
    await client.set('atlas:test:key', 'Hello Atlas!');
    const value = await client.get('atlas:test:key');
    console.log(`  Set/Get test: ${value === 'Hello Atlas!' ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 2: TTL operations
    console.log('\n⏱️  Test 2: TTL operations');
    await client.setEx('atlas:test:ttl', 5, 'Expires in 5 seconds');
    const ttl = await client.ttl('atlas:test:ttl');
    console.log(`  TTL test: ${ttl > 0 ? '✅ PASS' : '❌ FAIL'} (TTL: ${ttl}s)`);
    
    // Test 3: JSON operations
    console.log('\n📊 Test 3: JSON operations');
    const testData = { tier: 'core', userId: 'test-123', features: ['chat', 'voice'] };
    await client.set('atlas:test:json', JSON.stringify(testData));
    const jsonStr = await client.get('atlas:test:json');
    const parsed = JSON.parse(jsonStr);
    console.log(`  JSON test: ${parsed.tier === 'core' ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 4: Pattern deletion
    console.log('\n🗑️  Test 4: Pattern operations');
    await client.set('atlas:test:pattern:1', 'value1');
    await client.set('atlas:test:pattern:2', 'value2');
    const keys = await client.keys('atlas:test:pattern:*');
    console.log(`  Pattern search: ${keys.length === 2 ? '✅ PASS' : '❌ FAIL'} (Found ${keys.length} keys)`);
    
    // Cleanup
    await client.del('atlas:test:key', 'atlas:test:ttl', 'atlas:test:json', ...keys);
    
    // Test 5: Performance
    console.log('\n⚡ Test 5: Performance benchmark');
    const iterations = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await client.set(`atlas:bench:${i}`, `value${i}`);
    }
    
    const writeTime = Date.now() - startTime;
    const writeOps = (iterations / (writeTime / 1000)).toFixed(0);
    console.log(`  Write performance: ${writeOps} ops/sec`);
    
    const readStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      await client.get(`atlas:bench:${i}`);
    }
    
    const readTime = Date.now() - readStart;
    const readOps = (iterations / (readTime / 1000)).toFixed(0);
    console.log(`  Read performance: ${readOps} ops/sec`);
    
    // Cleanup benchmark keys
    const benchKeys = await client.keys('atlas:bench:*');
    if (benchKeys.length > 0) {
      await client.del(...benchKeys);
    }
    
    console.log('\n✅ All tests completed successfully!');
    console.log(`\n📊 Redis Info:`);
    const info = await client.info('server');
    const version = info.match(/redis_version:(.+)/)?.[1];
    console.log(`  Version: ${version}`);
    console.log(`  URL: ${REDIS_URL}`);
    
  } catch (error) {
    console.error('\n❌ Redis test failed:', error.message);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

// Run the test
testRedis().catch(console.error);
