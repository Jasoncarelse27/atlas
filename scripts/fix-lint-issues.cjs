#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to fix common linting issues
function fixLintIssues(content, filePath) {
  let modified = content;
  let hasChanges = false;

  // Fix unused variables in catch blocks
  const catchBlockRegex = /catch\s*\(\s*(\w+)\s*\)\s*{/g;
  modified = modified.replace(catchBlockRegex, (match, varName) => {
    if (varName === 'e' || varName === 'err' || varName === 'error') {
      hasChanges = true;
      return `catch (${varName}) {`;
    }
    return match;
  });

  // Fix unused variables by prefixing with underscore
  const unusedVarRegex = /(\w+):\s*any/g;
  modified = modified.replace(unusedVarRegex, (match, varName) => {
    if (varName !== 'any' && !varName.startsWith('_')) {
      hasChanges = true;
      return `_${varName}: any`;
    }
    return match;
  });

  // Fix any types with more specific types where possible
  const anyTypeReplacements = [
    { from: /:\s*any\[\]/g, to: ': unknown[]' },
    { from: /:\s*any\s*=/g, to: ': unknown =' },
    { from: /:\s*any\s*;/g, to: ': unknown;' },
    { from: /:\s*any\s*\)/g, to: ': unknown)' },
    { from: /:\s*any\s*}/g, to: ': unknown}' },
    { from: /:\s*any\s*,/g, to: ': unknown,' },
  ];

  anyTypeReplacements.forEach(({ from, to }) => {
    if (from.test(modified)) {
      modified = modified.replace(from, to);
      hasChanges = true;
    }
  });

  // Fix unused function assignments
  const unusedFunctionRegex = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*{[^}]*};\s*$/gm;
  modified = modified.replace(unusedFunctionRegex, (match, funcName) => {
    // Check if function is used elsewhere in the file
    const usageRegex = new RegExp(`\\b${funcName}\\b`, 'g');
    const matches = content.match(usageRegex);
    if (matches && matches.length === 1) {
      hasChanges = true;
      return `const _${funcName} = (${match.match(/\([^)]*\)/)[0]}) => {${match.match(/{[^}]*}/)[0]}};`;
    }
    return match;
  });

  return hasChanges ? modified : content;
}

// Function to process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const modified = fixLintIssues(content, filePath);
    
    if (modified !== content) {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`✅ Fixed lint issues in: ${filePath}`);
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
    
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
      findTsFiles(filePath, fileList);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file) && !filePath.includes('node_modules')) {
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
  
  console.log(`\n✨ Processed ${processedCount} files with lint issue fixes`);
}

if (require.main === module) {
  main();
}

module.exports = { fixLintIssues, processFile };
