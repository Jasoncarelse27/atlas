#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔍 Atlas AI Component Architecture Audit\n');

const componentsDir = path.join(__dirname, '../src/features/chat/components');
const hooksDir = path.join(__dirname, '../src/hooks');
const servicesDir = path.join(__dirname, '../src/services');

// Check if directories exist
const dirs = [
  { name: 'Components', path: componentsDir },
  { name: 'Hooks', path: hooksDir },
  { name: 'Services', path: servicesDir }
];

dirs.forEach(({ name, path: dirPath }) => {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
    console.log(`✅ ${name}: ${files.length} files`);
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      const hasExports = content.includes('export');
      const hasImports = content.includes('import');
      
      console.log(`   📄 ${file} (${lines} lines, ${hasExports ? '✅' : '❌'} exports, ${hasImports ? '✅' : '❌'} imports)`);
    });
  } else {
    console.log(`❌ ${name}: Directory not found`);
  }
});

console.log('\n📊 Architecture Health Check:');

// Check for large files (>200 lines)
let largeFiles = [];
function checkDirectory(dir, prefix = '') {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      checkDirectory(fullPath, prefix + item + '/');
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      
      if (lines > 200) {
        largeFiles.push({ file: prefix + item, lines });
      }
    }
  });
}

checkDirectory(path.join(__dirname, '../src'));

if (largeFiles.length > 0) {
  console.log('⚠️ Large files detected (consider refactoring):');
  largeFiles.forEach(({ file, lines }) => {
    console.log(`   📄 ${file}: ${lines} lines`);
  });
} else {
  console.log('✅ No large files detected - good component size!');
}

// Check for TypeScript usage
const tsFiles = [];
const jsFiles = [];
function countFileTypes(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      countFileTypes(fullPath);
    } else if (item.endsWith('.tsx')) {
      tsFiles.push(item);
    } else if (item.endsWith('.ts')) {
      tsFiles.push(item);
    } else if (item.endsWith('.jsx')) {
      jsFiles.push(item);
    } else if (item.endsWith('.js')) {
      jsFiles.push(item);
    }
  });
}

countFileTypes(path.join(__dirname, '../src'));

console.log(`\n📝 TypeScript Usage:`);
console.log(`   ✅ TypeScript files: ${tsFiles.length}`);
console.log(`   ⚠️ JavaScript files: ${jsFiles.length}`);

if (jsFiles.length > 0) {
  console.log('   Consider migrating JS files to TypeScript for better type safety');
}

console.log('\n🎯 Recommendations:');
console.log('   1. Keep components under 200 lines');
console.log('   2. Use TypeScript for all new files');
console.log('   3. Extract custom hooks for complex logic');
console.log('   4. Standardize prop interfaces');
console.log('   5. Add React.memo for performance optimization');

console.log('\n✅ Component audit complete!');
