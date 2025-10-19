#!/usr/bin/env node

/**
 * Script to replace hardcoded localhost references with environment variables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files to update with their specific replacements
const REPLACEMENTS = [
  // Frontend files
  {
    file: 'src/services/tierEnforcementService.ts',
    replacements: [
      {
        old: "this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';",
        new: "this.baseUrl = import.meta.env.VITE_API_URL || '';  // Use relative URLs for mobile compatibility"
      }
    ]
  },
  {
    file: 'src/services/fastspringService.ts',
    replacements: [
      {
        old: "${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}",
        new: "${import.meta.env.VITE_FRONTEND_URL || window.location.origin}"
      }
    ]
  },
  {
    file: 'src/hooks/useUsageIndicator.ts',
    replacements: [
      {
        old: 'const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";',
        new: 'const API_URL = import.meta.env.VITE_API_URL || "";  // Use relative URLs'
      }
    ]
  },
  {
    file: 'src/hooks/useTierMiddleware.ts',
    replacements: [
      {
        old: "const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';",
        new: "const baseUrl = import.meta.env.VITE_API_URL || '';  // Use relative URLs"
      }
    ]
  },
  {
    file: 'src/features/chat/services/messageService.ts',
    replacements: [
      {
        old: "const backendUrl = getEnvVar('VITE_API_URL') || 'http://localhost:3000';",
        new: "const backendUrl = getEnvVar('VITE_API_URL') || '';  // Use relative URLs"
      }
    ]
  },
  {
    file: 'src/components/TestingPanel.tsx',
    replacements: [
      {
        old: "const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';",
        new: "const backendUrl = import.meta.env.VITE_API_URL || '';  // Use relative URLs"
      },
      {
        old: "const localUrl = 'http://localhost:3000';",
        new: "const localUrl = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3000';  // For dev testing only"
      }
    ]
  },
  {
    file: 'src/components/DevelopmentHelper.tsx',
    replacements: [
      {
        old: "server: { status: 'running', port: 5173, url: 'http://localhost:5173' },",
        new: "server: { status: 'running', port: 5173, url: window.location.origin },"
      }
    ]
  },
  {
    file: 'src/components/RailwayPingTest.tsx',
    replacements: [
      {
        old: "const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';",
        new: "const backendUrl = import.meta.env.VITE_API_URL || '';  // Use relative URLs"
      },
      {
        old: "Backend URL: {import.meta.env.VITE_API_URL || 'http://localhost:3000'}",
        new: "Backend URL: {import.meta.env.VITE_API_URL || window.location.origin}"
      }
    ]
  },
  {
    file: 'src/utils/getBaseUrl.ts',
    replacements: [
      {
        old: '// Use environment variable with fallback to localhost for development\n  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";',
        new: '// Use environment variable with fallback to relative URLs for mobile compatibility\n  const API_URL = import.meta.env.VITE_API_URL || "";'
      }
    ]
  },
  // Backend files
  {
    file: 'backend/server.mjs',
    replacements: [
      {
        old: 'return "localhost";',
        new: 'return process.env.HOST_IP || "localhost";'
      },
      {
        old: "'http://localhost:5173',",
        new: `process.env.FRONTEND_URL || 'http://localhost:5173',`
      },
      {
        old: "'http://localhost:3000',",
        new: `process.env.BACKEND_URL || 'http://localhost:3000',`
      }
    ]
  }
];

let totalReplacements = 0;
let filesModified = 0;

/**
 * Process replacements for a file
 */
function processFile(fileConfig) {
  const filePath = path.join(process.cwd(), fileConfig.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fileConfig.file}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    fileConfig.replacements.forEach(replacement => {
      if (content.includes(replacement.old)) {
        content = content.replace(replacement.old, replacement.new);
        modified = true;
        totalReplacements++;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      filesModified++;
      console.log(`✅ ${fileConfig.file}: Replaced localhost references`);
    } else {
      console.log(`ℹ️  ${fileConfig.file}: No changes needed`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${fileConfig.file}:`, error.message);
  }
}

/**
 * Main execution
 */
console.log('🔍 Replacing hardcoded localhost references...\n');

// Change to project root
process.chdir(path.join(__dirname, '..'));

// Process all files
REPLACEMENTS.forEach(fileConfig => {
  processFile(fileConfig);
});

console.log('\n📊 Summary:');
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);

if (totalReplacements > 0) {
  console.log('\n✅ Localhost replacement complete!');
  console.log('\n⚠️  Important: Add these environment variables to your .env files:');
  console.log('   - VITE_API_URL (frontend → backend API URL)');
  console.log('   - VITE_FRONTEND_URL (for callbacks and redirects)');
  console.log('   - HOST_IP (for backend to detect network IP)');
  console.log('   - FRONTEND_URL (for CORS in backend)');
  console.log('   - BACKEND_URL (for backend self-reference)');
} else {
  console.log('\n✅ No localhost references found to replace.');
}
