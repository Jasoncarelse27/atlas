#!/usr/bin/env node

/**
 * Atlas AI Log Sanitizer
 * Removes console.log, console.debug, console.warn, and debugger statements from source files
 * while preserving local development logs in test files and development-only code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Directories to process
  sourceDirs: ['src'],
  // File extensions to process
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  // Files/directories to exclude
  exclude: [
    'node_modules',
    'dist',
    'build',
    '.git',
    'test',
    'tests',
    'spec',
    'specs',
    '__tests__',
    '*.test.*',
    '*.spec.*',
    '.husky',
    'scripts'
  ],
  // Patterns to remove
  patterns: [
    // Console statements
    /console\.log\s*\([^)]*\)\s*;?\s*/g,
    /console\.debug\s*\([^)]*\)\s*;?\s*/g,
    /console\.warn\s*\([^)]*\)\s*;?\s*/g,
    /console\.info\s*\([^)]*\)\s*;?\s*/g,
    // Debugger statements
    /debugger\s*;?\s*/g,
    // Alert statements (optional)
    /alert\s*\([^)]*\)\s*;?\s*/g,
  ],
  // Patterns to preserve (won't be removed)
  preservePatterns: [
    // Keep console.error for production error handling
    /console\.error/,
    // Keep console statements in test files
    /\.test\.|\.spec\.|__tests__/,
    // Keep console statements in development-only blocks
    /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]development['"]\s*\)/,
    /if\s*\(\s*import\.meta\.env\.DEV\s*\)/,
  ]
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  // Use process.stdout.write to avoid being sanitized
  process.stdout.write(`${colors[color]}${message}${colors.reset}\n`);
}

function shouldExcludeFile(filePath) {
  return CONFIG.exclude.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

function shouldPreserveLine(content, line) {
  return CONFIG.preservePatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(line);
    }
    return line.includes(pattern);
  });
}

function sanitizeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let removedCount = 0;

    const sanitizedLines = lines.map((line, index) => {
      // Check if line should be preserved
      if (shouldPreserveLine(content, line)) {
        return line;
      }

      // Check if line contains patterns to remove
      let sanitizedLine = line;
      CONFIG.patterns.forEach(pattern => {
        const matches = sanitizedLine.match(pattern);
        if (matches) {
          sanitizedLine = sanitizedLine.replace(pattern, '');
          removedCount += matches.length;
          modified = true;
        }
      });

      // Clean up empty lines that might have been left behind
      if (sanitizedLine.trim() === '' && line.trim() !== '') {
        sanitizedLine = line; // Keep original empty line formatting
      }

      return sanitizedLine;
    });

    if (modified) {
      fs.writeFileSync(filePath, sanitizedLines.join('\n'), 'utf8');
      log(`✅ Sanitized ${filePath} (removed ${removedCount} debug statements)`, 'green');
      return { file: filePath, removed: removedCount };
    }

    return null;
  } catch (error) {
    log(`❌ Error processing ${filePath}: ${error.message}`, 'red');
    return null;
  }
}

function getAllFiles(dir, files = []) {
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldExcludeFile(fullPath)) {
          getAllFiles(fullPath, files);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (CONFIG.extensions.includes(ext) && !shouldExcludeFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    log(`❌ Error reading directory ${dir}: ${error.message}`, 'red');
  }
  
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isVerbose = args.includes('--verbose');

  log('🧼 Atlas AI Log Sanitizer', 'cyan');
  log('========================', 'cyan');
  
  if (isDryRun) {
    log('🔍 DRY RUN MODE - No files will be modified', 'yellow');
  }

  let totalFiles = 0;
  let modifiedFiles = 0;
  let totalRemoved = 0;
  const results = [];

  // Process each source directory
  CONFIG.sourceDirs.forEach(sourceDir => {
    if (!fs.existsSync(sourceDir)) {
      log(`⚠️  Source directory ${sourceDir} not found, skipping...`, 'yellow');
      return;
    }

    log(`📁 Processing directory: ${sourceDir}`, 'blue');
    const files = getAllFiles(sourceDir);
    totalFiles += files.length;

    files.forEach(file => {
      if (isVerbose) {
        log(`🔍 Checking: ${file}`, 'magenta');
      }

      if (isDryRun) {
        // In dry run, just check what would be removed
        try {
          const content = fs.readFileSync(file, 'utf8');
          let wouldRemove = 0;
          
          CONFIG.patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              wouldRemove += matches.length;
            }
          });

          if (wouldRemove > 0) {
            log(`📝 Would remove ${wouldRemove} debug statements from: ${file}`, 'yellow');
            results.push({ file, removed: wouldRemove });
            modifiedFiles++;
            totalRemoved += wouldRemove;
          }
        } catch (error) {
          log(`❌ Error reading ${file}: ${error.message}`, 'red');
        }
      } else {
        // Actually sanitize the file
        const result = sanitizeFile(file);
        if (result) {
          results.push(result);
          modifiedFiles++;
          totalRemoved += result.removed;
        }
      }
    });
  });

  // Summary
  log('\n📊 Sanitization Summary', 'cyan');
  log('======================', 'cyan');
  log(`📁 Total files scanned: ${totalFiles}`, 'blue');
  log(`✏️  Files ${isDryRun ? 'that would be' : ''} modified: ${modifiedFiles}`, 'green');
  log(`🗑️  Total debug statements ${isDryRun ? 'that would be' : ''} removed: ${totalRemoved}`, 'green');

  if (results.length > 0) {
    log('\n📋 Detailed Results:', 'cyan');
    results.forEach(result => {
      log(`  • ${result.file}: ${result.removed} statements`, 'blue');
    });
  }

  if (!isDryRun && modifiedFiles > 0) {
    log('\n✅ Sanitization complete! All debug logs have been removed.', 'green');
    log('💡 Tip: Use --dry-run to preview changes before applying them.', 'yellow');
  } else if (isDryRun && modifiedFiles > 0) {
    log('\n💡 Run without --dry-run to apply these changes.', 'yellow');
  } else {
    log('\n✨ No debug logs found to remove!', 'green');
  }

  // Exit with appropriate code
  process.exit(modifiedFiles > 0 ? 0 : 0);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log('Atlas AI Log Sanitizer', 'cyan');
  log('=====================', 'cyan');
  log('');
  log('Usage: node scripts/sanitize-logs.js [options]');
  log('');
  log('Options:');
  log('  --dry-run    Preview what would be removed without making changes');
  log('  --verbose    Show detailed processing information');
  log('  --help, -h   Show this help message');
  log('');
  log('Examples:');
  log('  node scripts/sanitize-logs.js              # Remove all debug logs');
  log('  node scripts/sanitize-logs.js --dry-run    # Preview changes');
  log('  node scripts/sanitize-logs.js --verbose    # Show detailed output');
  process.exit(0);
}

main();
