#!/usr/bin/env node

// Railway backend monitoring script
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://atlas-production-2123.up.railway.app';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const color = {
    'INFO': colors.blue,
    'SUCCESS': colors.green,
    'WARNING': colors.yellow,
    'ERROR': colors.red
  }[level] || colors.reset;

  console.log(`${color}[${level}]${colors.reset} ${timestamp} - ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Test Railway backend health
 */
async function testRailwayHealth() {
  try {
    log('INFO', 'Testing Railway backend health...');
    
    const response = await axios.get(`${RAILWAY_URL}/healthz`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Atlas-Monitor/1.0'
      }
    });

    if (response.status === 200 && response.data.status === 'ok') {
      log('SUCCESS', 'Railway backend is healthy', {
        uptime: response.data.uptime,
        responseTime: response.headers['x-response-time'] || 'N/A'
      });
      return { success: true, data: response.data };
    } else {
      log('WARNING', 'Railway backend returned unexpected response', response.data);
      return { success: false, error: 'Unexpected response' };
    }
  } catch (error) {
    log('ERROR', 'Railway backend health check failed', {
      message: error.message,
      code: error.code,
      status: error.response?.status
    });
    return { success: false, error: error.message };
  }
}

/**
 * Test API endpoints
 */
async function testAPIEndpoints() {
  const endpoints = [
    { path: '/healthz', name: 'Health Check' },
    { path: '/ping', name: 'Ping Test' },
    { path: '/', name: 'Root Endpoint' }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      log('INFO', `Testing ${endpoint.name}...`);
      
      const response = await axios.get(`${RAILWAY_URL}${endpoint.path}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'Atlas-Monitor/1.0' }
      });

      if (response.status === 200) {
        log('SUCCESS', `${endpoint.name} is working`);
        results.push({ 
          endpoint: endpoint.name, 
          status: 'success', 
          responseTime: response.headers['x-response-time'] || 'N/A'
        });
      }
    } catch (error) {
      log('ERROR', `${endpoint.name} failed`, {
        status: error.response?.status,
        message: error.message
      });
      results.push({ 
        endpoint: endpoint.name, 
        status: 'error', 
        error: error.message 
      });
    }
  }

  return results;
}

/**
 * Log monitoring results to Supabase
 */
async function logToSupabase(results) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('WARNING', 'Supabase credentials not configured - skipping database logging');
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { error } = await supabase
      .from('monitoring_logs')
      .insert([{
        service: 'railway-backend',
        status: results.success ? 'healthy' : 'unhealthy',
        details: results,
        timestamp: new Date().toISOString()
      }]);

    if (error) {
      log('ERROR', 'Failed to log to Supabase', error);
    } else {
      log('SUCCESS', 'Monitoring results logged to Supabase');
    }
  } catch (error) {
    log('ERROR', 'Supabase logging failed', error.message);
  }
}

/**
 * Send alert if needed
 */
async function sendAlert(results) {
  if (!results.success) {
    log('WARNING', 'Service is unhealthy - alert should be sent');
    
    // Here you would integrate with your alerting system
    // For now, we'll just log it
    console.log('🚨 ALERT: Railway backend is down or unhealthy');
    console.log('📊 Results:', JSON.stringify(results, null, 2));
  }
}

/**
 * Main monitoring function
 */
async function runMonitoring() {
  log('INFO', '🔍 Starting Atlas Railway monitoring check');
  
  const healthResult = await testRailwayHealth();
  const endpointResults = await testAPIEndpoints();
  
  const overallResults = {
    success: healthResult.success,
    timestamp: new Date().toISOString(),
    health: healthResult,
    endpoints: endpointResults
  };

  // Log to Supabase
  await logToSupabase(overallResults);
  
  // Send alerts if needed
  await sendAlert(overallResults);
  
  log('INFO', '✅ Monitoring check completed');
  
  return overallResults;
}

// Run monitoring if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMonitoring().catch(error => {
    log('ERROR', 'Monitoring script failed', error);
    process.exit(1);
  });
}

export { runMonitoring };
