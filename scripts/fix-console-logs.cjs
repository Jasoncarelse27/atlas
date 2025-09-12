#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to exclude from console.log replacement
const excludeFiles = [
  'src/utils/logger.ts', // Our logger utility
  'src/test/', // Test files
  'node_modules/',
  '.git/'
];

// Function to check if file should be excluded
function shouldExcludeFile(filePath) {
  return excludeFiles.some(exclude => filePath.includes(exclude));
}

// Function to replace console statements with logger
function replaceConsoleStatements(content, filePath) {
  // Skip if file should be excluded
  if (shouldExcludeFile(filePath)) {
    return content;
  }

  let modified = content;
  let hasChanges = false;

  // Add logger import if not already present and we're making changes
  const hasLoggerImport = content.includes("import { logger }");
  const hasConsoleStatements = /console\.(log|error|warn|info|debug)/.test(content);

  if (hasConsoleStatements && !hasLoggerImport) {
    // Find the last import statement
    const importRegex = /^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm;
    const imports = content.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const loggerImport = "import { logger } from '../utils/logger';";
      modified = modified.replace(lastImport, lastImport + '\n' + loggerImport);
      hasChanges = true;
    }
  }

  // Replace console statements
  const replacements = [
    { from: /console\.log\(/g, to: 'logger.info(' },
    { from: /console\.error\(/g, to: 'logger.error(' },
    { from: /console\.warn\(/g, to: 'logger.warn(' },
    { from: /console\.info\(/g, to: 'logger.info(' },
    { from: /console\.debug\(/g, to: 'logger.debug(' }
  ];

  replacements.forEach(({ from, to }) => {
    if (from.test(modified)) {
      modified = modified.replace(from, to);
      hasChanges = true;
    }
  });

  return hasChanges ? modified : content;
}

// Function to process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const modified = replaceConsoleStatements(content, filePath);
    
    if (modified !== content) {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`✅ Fixed console statements in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find TypeScript/JavaScript files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !shouldExcludeFile(filePath)) {
      findTsFiles(filePath, fileList);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file) && !shouldExcludeFile(filePath)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main execution
function main() {
  const srcDir = path.join(__dirname, '..', 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ src directory not found');
    process.exit(1);
  }

  console.log('🔍 Finding TypeScript/JavaScript files...');
  const files = findTsFiles(srcDir);
  
  console.log(`📁 Found ${files.length} files to process`);
  
  let processedCount = 0;
  files.forEach(file => {
    if (processFile(file)) {
      processedCount++;
    }
  });
  
  console.log(`\n✨ Processed ${processedCount} files with console statement replacements`);
}

if (require.main === module) {
  main();
}

module.exports = { replaceConsoleStatements, processFile };
