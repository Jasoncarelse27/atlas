#!/usr/bin/env node
// Script to replace console.* with logger.* in src files
// Excludes test files and logger.ts itself

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to process
const srcPattern = path.join(__dirname, '../src/**/*.{ts,tsx,js,jsx}');

// Files to exclude
const excludePatterns = [
  '**/logger.ts',
  '**/*.test.*',
  '**/*.spec.*',
  '**/test/**',
  '**/__tests__/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**'
];

// Get all source files
const files = glob.sync(srcPattern, {
  ignore: excludePatterns
});

console.log(`Found ${files.length} files to process`);

let totalReplacements = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let hasChanges = false;
  let hasLoggerImport = content.includes("from '../lib/logger'") || 
                        content.includes('from "@/lib/logger"') ||
                        content.includes("from './lib/logger'") ||
                        content.includes("from '../../lib/logger'") ||
                        content.includes("from '../../../lib/logger'");
  
  // Replace console.log with logger.debug
  const logMatches = content.match(/console\.log\(/g);
  if (logMatches) {
    content = content.replace(/console\.log\(/g, 'logger.debug(');
    hasChanges = true;
    totalReplacements += logMatches.length;
  }
  
  // Replace console.error with logger.error
  const errorMatches = content.match(/console\.error\(/g);
  if (errorMatches) {
    content = content.replace(/console\.error\(/g, 'logger.error(');
    hasChanges = true;
    totalReplacements += errorMatches.length;
  }
  
  // Replace console.warn with logger.warn
  const warnMatches = content.match(/console\.warn\(/g);
  if (warnMatches) {
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    hasChanges = true;
    totalReplacements += warnMatches.length;
  }
  
  // Replace console.info with logger.info
  const infoMatches = content.match(/console\.info\(/g);
  if (infoMatches) {
    content = content.replace(/console\.info\(/g, 'logger.info(');
    hasChanges = true;
    totalReplacements += infoMatches.length;
  }
  
  if (hasChanges) {
    // Add logger import if not present
    if (!hasLoggerImport) {
      // Calculate relative path to logger
      const fileDir = path.dirname(file);
      const loggerPath = path.join(__dirname, '../src/lib/logger');
      let relativePath = path.relative(fileDir, loggerPath);
      
      // Ensure forward slashes
      relativePath = relativePath.replace(/\\/g, '/');
      
      // Remove .ts extension if present
      relativePath = relativePath.replace(/\.ts$/, '');
      
      // Add ./ if it doesn't start with ../
      if (!relativePath.startsWith('../') && !relativePath.startsWith('./')) {
        relativePath = './' + relativePath;
      }
      
      // Find the right place to add import
      const importRegex = /^import\s+.*$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        // Add after last import
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const endOfLine = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLine + 1) + 
                  `import { logger } from '${relativePath}';\n` + 
                  content.slice(endOfLine + 1);
      } else {
        // Add at the beginning
        content = `import { logger } from '${relativePath}';\n\n` + content;
      }
    }
    
    // Write back
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Updated ${path.relative(process.cwd(), file)}`);
  }
});

console.log(`\n✨ Complete! Replaced ${totalReplacements} console statements.`);
