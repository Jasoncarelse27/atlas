#!/usr/bin/env node

/**
 * Test script for Atlas Backend /ping endpoint
 * Usage: node test-ping.js
 */

import http from 'http';

const PORT = process.env.PORT || 8000;
const HOST = 'localhost';

function testPingEndpoint() {
  console.log('🏓 Testing Atlas Backend /ping endpoint...');
  console.log(`📍 URL: http://${HOST}:${PORT}/ping`);
  console.log('⏳ Sending request...\n');

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/ping',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Atlas-Ping-Test/1.0'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`📡 Response Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`📋 Headers: ${JSON.stringify(res.headers, null, 2)}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonResponse = JSON.parse(data);
        console.log('\n✅ Response Body:');
        console.log(JSON.stringify(jsonResponse, null, 2));
        
        // Validate response
        if (jsonResponse.status === 'ok' && jsonResponse.message === 'Atlas backend is alive!') {
          console.log('\n🎉 SUCCESS: /ping endpoint is working correctly!');
          process.exit(0);
        } else {
          console.log('\n❌ FAILED: Response format is incorrect');
          process.exit(1);
        }
      } catch (error) {
        console.log('\n❌ FAILED: Could not parse JSON response');
        console.log('Raw response:', data);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.log('\n❌ FAILED: Request error');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Tip: Make sure the backend server is running with: npm start');
    }
    
    process.exit(1);
  });

  req.setTimeout(5000, () => {
    console.log('\n❌ FAILED: Request timeout (5 seconds)');
    req.destroy();
    process.exit(1);
  });

  req.end();
}

// Run the test
testPingEndpoint();
