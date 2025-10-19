#!/usr/bin/env node

/**
 * Script to replace console.* calls with proper logger calls
 * Excludes logger files themselves and test files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to scan
const DIRS_TO_SCAN = ['backend', 'src'];

// Files to exclude
const EXCLUDE_PATTERNS = [
  'logger.ts',
  'logger.js',
  'logger.mjs',
  'test.js',
  'test.ts',
  'spec.js',
  'spec.ts',
  'node_modules'
];

// Console method mappings
const CONSOLE_TO_LOGGER = {
  'console.log': 'logger.debug',
  'console.info': 'logger.info',
  'console.warn': 'logger.warn',
  'console.error': 'logger.error',
  'console.debug': 'logger.debug',
  'console.trace': 'logger.debug'
};

let totalReplacements = 0;
let filesModified = 0;

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

/**
 * Get the appropriate logger import statement
 */
function getLoggerImport(filePath) {
  const ext = path.extname(filePath);
  const isBackend = filePath.includes('backend/');
  
  if (isBackend) {
    // Calculate relative path from file to logger
    const fileDir = path.dirname(filePath);
    const loggerPath = path.join(process.cwd(), 'backend/lib/logger.mjs');
    let relativePath = path.relative(fileDir, loggerPath);
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    
    if (ext === '.mjs') {
      return `import { logger } from '${relativePath}';`;
    } else {
      return `const { logger } = require('${relativePath}');`;
    }
  } else {
    // Frontend TypeScript
    if (filePath.includes('src/lib/')) {
      return "import { logger } from './logger';";
    }
    return "import { logger } from '@/lib/logger';";
  }
}

/**
 * Check if logger is already imported
 */
function hasLoggerImport(content) {
  return content.includes('logger') && 
         (content.includes('import') || content.includes('require')) &&
         (content.includes('./logger') || content.includes('@/lib/logger'));
}

/**
 * Process a single file
 */
function processFile(filePath) {
  if (shouldExclude(filePath)) {
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let replacements = 0;
    
    // Replace console.* calls
    Object.entries(CONSOLE_TO_LOGGER).forEach(([consoleMethod, loggerMethod]) => {
      const regex = new RegExp(`\\b${consoleMethod.replace('.', '\\.')}\\(`, 'g');
      const matches = content.match(regex);
      if (matches) {
        replacements += matches.length;
        content = content.replace(regex, `${loggerMethod}(`);
      }
    });
    
    if (replacements > 0) {
      // Add logger import if not present
      if (!hasLoggerImport(content)) {
        const importStatement = getLoggerImport(filePath);
        
        // Add import at the top of the file
        if (content.startsWith('//') || content.startsWith('/*')) {
          // Skip file header comments
          const firstCodeLine = content.split('\n').findIndex(line => 
            !line.trim().startsWith('//') && 
            !line.trim().startsWith('*') &&
            line.trim() !== ''
          );
          const lines = content.split('\n');
          lines.splice(firstCodeLine, 0, importStatement);
          content = lines.join('\n');
        } else {
          content = importStatement + '\n' + content;
        }
      }
      
      // Write the modified content
      fs.writeFileSync(filePath, content);
      
      totalReplacements += replacements;
      filesModified++;
      
      console.log(`✅ ${filePath}: Replaced ${replacements} console.* calls`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules')) {
      scanDirectory(filePath);
    } else if (stat.isFile() && (
      file.endsWith('.js') || 
      file.endsWith('.mjs') || 
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    )) {
      processFile(filePath);
    }
  });
}

/**
 * Main execution
 */
console.log('🔍 Scanning for console.* calls...\n');

// Change to project root
process.chdir(path.join(__dirname, '..'));

// Scan directories
DIRS_TO_SCAN.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`📁 Scanning ${dir}/...`);
    scanDirectory(dir);
  }
});

console.log('\n📊 Summary:');
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);

if (totalReplacements > 0) {
  console.log('\n✅ Console.* replacement complete!');
  console.log('   Please review the changes and test the application.');
} else {
  console.log('\n✅ No console.* calls found (excluding logger files).');
}
