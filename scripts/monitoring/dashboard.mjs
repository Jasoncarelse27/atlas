#!/usr/bin/env node

// Local monitoring dashboard
import { runMonitoring } from './railway-monitor.mjs';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log(`${colors.cyan}
  ╔═══════════════════════════════════════╗
  ║           Atlas Monitoring            ║
  ║         Live Dashboard v1.0           ║
  ╚═══════════════════════════════════════╝
  ${colors.reset}`);
}

function printStatus(results) {
  const status = results.success ? 'HEALTHY' : 'UNHEALTHY';
  const statusColor = results.success ? colors.green : colors.red;
  
  console.log(`${statusColor}
  🏥 Overall Status: ${status}
  ⏰ Last Check: ${new Date(results.timestamp).toLocaleTimeString()}
  ${colors.reset}`);
  
  // Health details
  if (results.health.data) {
    console.log(`${colors.blue}
  📊 Backend Health:${colors.reset}
    ⏱️  Uptime: ${Math.floor(results.health.data.uptime / 60)}m ${Math.floor(results.health.data.uptime % 60)}s
    🔄 Response Time: ${results.health.responseTime || 'N/A'}
    📡 Status: ${results.health.data.status}
  `);
  }
  
  // Endpoint results
  console.log(`${colors.blue}
  🔗 Endpoint Status:${colors.reset}`);
  
  results.endpoints.forEach(endpoint => {
    const icon = endpoint.status === 'success' ? '✅' : '❌';
    const color = endpoint.status === 'success' ? colors.green : colors.red;
    console.log(`    ${icon} ${color}${endpoint.endpoint}${colors.reset} - ${endpoint.responseTime || endpoint.error}`);
  });
}

function printCommands() {
  console.log(`${colors.yellow}
  Commands:
    r - Refresh now
    q - Quit
    h - Help
  ${colors.reset}`);
}

async function runDashboard() {
  let running = true;
  let results = null;
  
  // Initial run
  console.log('🔄 Starting Atlas monitoring dashboard...');
  results = await runMonitoring();
  
  const refreshInterval = setInterval(async () => {
    if (running) {
      results = await runMonitoring();
      displayDashboard(results);
    }
  }, 30000); // Refresh every 30 seconds
  
  function displayDashboard(results) {
    clearScreen();
    printHeader();
    printStatus(results);
    printCommands();
    console.log('\n⏱️  Auto-refresh in 30s... (Press any key for commands)');
  }
  
  // Initial display
  displayDashboard(results);
  
  // Handle user input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', async (key) => {
    switch (key.toLowerCase()) {
      case 'r':
        console.log('\n🔄 Refreshing...');
        results = await runMonitoring();
        displayDashboard(results);
        break;
        
      case 'q':
        console.log('\n👋 Goodbye!');
        clearInterval(refreshInterval);
        running = false;
        process.exit(0);
        break;
        
      case 'h':
        console.log(`${colors.blue}
  Atlas Monitoring Dashboard Help:
  
  Commands:
    r - Refresh monitoring data now
    q - Quit the dashboard
    h - Show this help
  
  The dashboard automatically refreshes every 30 seconds.
  It monitors:
    • Railway backend health
    • API endpoint availability
    • Response times
    • Database connectivity
        ${colors.reset}`);
        break;
        
      case '\u0003': // Ctrl+C
        console.log('\n👋 Goodbye!');
        clearInterval(refreshInterval);
        running = false;
        process.exit(0);
        break;
    }
  });
}

// Run dashboard if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDashboard().catch(error => {
    console.error('Dashboard failed:', error);
    process.exit(1);
  });
}
