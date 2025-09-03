#!/usr/bin/env node

/**
 * 🚀 Atlas AI Backend Port Manager (Cross-Platform)
 * Automatically clears port 8000 and starts the backend server
 */

import { execSync, spawn } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`🔍 ${message}`, 'cyan');
}

function logHeader(message) {
  log(`\n${colors.bright}${message}${colors.reset}`, 'blue');
}

// Check if port is in use
function isPortInUse(port) {
  try {
    if (platform() === 'win32') {
      // Windows
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      return result.trim().length > 0;
    } else {
      // macOS/Linux
      const result = execSync(`lsof -i :${port}`, { encoding: 'utf8' });
      return result.trim().length > 0;
    }
  } catch (error) {
    return false; // Port is not in use
  }
}

// Kill processes using port
function killPort(port) {
  try {
    if (platform() === 'win32') {
      // Windows
      const pids = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        })
        .filter(pid => pid && !isNaN(pid));

      pids.forEach(pid => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          log(`Killed process ID: ${pid}`, 'yellow');
        } catch (error) {
          log(`Failed to kill process ${pid}: ${error.message}`, 'red');
        }
      });
    } else {
      // macOS/Linux
      const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' })
        .split('\n')
        .filter(pid => pid.trim() && !isNaN(pid));

      pids.forEach(pid => {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          log(`Killed process ID: ${pid}`, 'yellow');
        } catch (error) {
          log(`Failed to kill process ${pid}: ${error.message}`, 'red');
        }
      });
    }
    return true;
  } catch (error) {
    logError(`Failed to kill processes on port ${port}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  const port = 8000;
  
  logHeader('🚀 Atlas AI Backend Port Manager');
  logInfo(`Checking port ${port} status...`);

  // Check if port is in use
  if (isPortInUse(port)) {
    logWarning(`Port ${port} is in use. Clearing processes...`);
    
    // Kill processes using the port
    if (killPort(port)) {
      // Wait for processes to fully terminate
      logInfo('Waiting for processes to terminate...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify port is free
      if (isPortInUse(port)) {
        logError(`Port ${port} is still in use. Cannot start backend.`);
        logInfo(`Check what's using the port manually.`);
        process.exit(1);
      }
      
      logSuccess(`Port ${port} cleared successfully!`);
    } else {
      logError(`Failed to clear port ${port}`);
      process.exit(1);
    }
  } else {
    logSuccess(`Port ${port} is free`);
  }

  // Verify port is actually free before proceeding
  if (isPortInUse(port)) {
    logError(`Port ${port} is still in use. Cannot start backend.`);
    process.exit(1);
  }

  logHeader('🚀 Starting Atlas AI Backend Server');
  logInfo(`Working directory: ${process.cwd()}`);
  logInfo(`Server will be available at: http://localhost:${port}`);
  logInfo(`Health check: http://localhost:${port}/healthz`);
  log('');

  // Start the backend server
  try {
    const backendDir = join(__dirname, '..', 'backend');
    logInfo(`Changing to backend directory: ${backendDir}`);
    
    process.chdir(backendDir);
    
    logSuccess('Starting backend server with npm run dev...');
    
    // Spawn the npm process
    const npmProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true
    });

    // Handle process events
    npmProcess.on('error', (error) => {
      logError(`Failed to start npm process: ${error.message}`);
      process.exit(1);
    });

    npmProcess.on('exit', (code) => {
      if (code !== 0) {
        logError(`Backend server exited with code ${code}`);
        process.exit(code);
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      logInfo('Received SIGINT, shutting down backend...');
      npmProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logInfo('Received SIGTERM, shutting down backend...');
      npmProcess.kill('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    logError(`Failed to start backend: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
