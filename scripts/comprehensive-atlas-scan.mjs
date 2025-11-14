#!/usr/bin/env node

/**
 * Atlas Comprehensive Codebase Scan
 * Scans codebase for quality, best practices, security, and architecture issues
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const issues = {
  codeQuality: [],
  bestPractices: [],
  security: [],
  performance: [],
  architecture: [],
  database: [],
  mobileWeb: []
};

// File patterns to scan
const SCAN_PATTERNS = {
  ts: ['.ts', '.tsx'],
  js: ['.js', '.mjs', '.jsx'],
  sql: ['.sql']
};

// Get all files recursively
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    // Skip node_modules, dist, .git, etc.
    if (file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === 'build') {
      return;
    }
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      const ext = extname(file);
      if (SCAN_PATTERNS.ts.includes(ext) || SCAN_PATTERNS.js.includes(ext) || SCAN_PATTERNS.sql.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// Scan for code quality issues
function scanCodeQuality(files) {
  console.log('📊 Scanning code quality...');
  
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      // Check for console.log (should use logger)
      lines.forEach((line, index) => {
        if (line.includes('console.log') && !line.includes('//') && !file.includes('test')) {
          issues.codeQuality.push({
            file: file.replace(ROOT_DIR, ''),
            line: index + 1,
            issue: 'console.log found - should use logger',
            severity: 'low'
          });
        }
      });
      
      // Check for TODO/FIXME comments
      lines.forEach((line, index) => {
        if (line.includes('TODO') || line.includes('FIXME')) {
          issues.codeQuality.push({
            file: file.replace(ROOT_DIR, ''),
            line: index + 1,
            issue: `TODO/FIXME: ${line.trim()}`,
            severity: 'info'
          });
        }
      });
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Scan for best practices
function scanBestPractices(files) {
  console.log('✅ Scanning best practices...');
  
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for hardcoded tier checks (should use useTierAccess)
      if (content.includes('tier === "free"') || content.includes('tier === "core"') || content.includes('tier === "studio"')) {
        if (!file.includes('useTierAccess') && !file.includes('featureAccess')) {
          issues.bestPractices.push({
            file: file.replace(ROOT_DIR, ''),
            issue: 'Hardcoded tier check - should use useTierAccess hook',
            severity: 'medium'
          });
        }
      }
      
      // Check for localStorage usage patterns
      if (content.includes('localStorage.setItem') && !content.includes('atlas:')) {
        issues.bestPractices.push({
          file: file.replace(ROOT_DIR, ''),
          issue: 'localStorage key should use "atlas:" prefix',
          severity: 'low'
        });
      }
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Scan for security issues
function scanSecurity(files) {
  console.log('🔒 Scanning security...');
  
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for exposed API keys
      const apiKeyPatterns = [
        /ANTHROPIC_API_KEY\s*=\s*['"](.*?)['"]/,
        /SUPABASE_KEY\s*=\s*['"](.*?)['"]/,
        /API_KEY\s*=\s*['"](.*?)['"]/
      ];
      
      apiKeyPatterns.forEach(pattern => {
        const match = content.match(pattern);
        if (match && match[1] && match[1].length > 20) {
          issues.security.push({
            file: file.replace(ROOT_DIR, ''),
            issue: 'Potential API key exposure - check if hardcoded',
            severity: 'high'
          });
        }
      });
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Scan for performance issues
function scanPerformance(files) {
  console.log('⚡ Scanning performance...');
  
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for missing useMemo/useCallback in expensive operations
      if (content.includes('useEffect') && content.includes('filter') && !content.includes('useMemo')) {
        if (file.includes('components') || file.includes('hooks')) {
          issues.performance.push({
            file: file.replace(ROOT_DIR, ''),
            issue: 'Consider using useMemo for expensive filter operations',
            severity: 'low'
          });
        }
      }
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Scan architecture patterns
function scanArchitecture(files) {
  console.log('🏗️  Scanning architecture...');
  
  const componentFiles = files.filter(f => f.includes('components') && f.endsWith('.tsx'));
  // Note: hookFiles reserved for future hook-specific scanning
  
  // Check for proper component structure
  componentFiles.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for ErrorBoundary usage
      if (content.includes('ErrorBoundary') && !content.includes('from')) {
        issues.architecture.push({
          file: file.replace(ROOT_DIR, ''),
          issue: 'ErrorBoundary imported but may not be used',
          severity: 'low'
        });
      }
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Scan database migrations
function scanDatabase(files) {
  console.log('🗄️  Scanning database...');
  
  const migrationFiles = files.filter(f => f.includes('migrations') && f.endsWith('.sql'));
  
  migrationFiles.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for idempotent migrations
      if (content.includes('CREATE TABLE') && !content.includes('IF NOT EXISTS')) {
        issues.database.push({
          file: file.replace(ROOT_DIR, ''),
          issue: 'Migration may not be idempotent - consider IF NOT EXISTS',
          severity: 'medium'
        });
      }
      
      // Check for missing RLS policies
      if (content.includes('CREATE TABLE') && !content.includes('ROW LEVEL SECURITY') && !content.includes('RLS')) {
        issues.database.push({
          file: file.replace(ROOT_DIR, ''),
          issue: 'Table created without RLS - security concern',
          severity: 'high'
        });
      }
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Scan mobile/web patterns
function scanMobileWeb(files) {
  console.log('📱 Scanning mobile/web patterns...');
  
  files.forEach(file => {
    try {
      const content = readFileSync(file, 'utf-8');
      
      // Check for mobile optimization hook usage
      if (file.includes('components') && content.includes('isMobile') && !content.includes('useMobileOptimization')) {
        issues.mobileWeb.push({
          file: file.replace(ROOT_DIR, ''),
          issue: 'Mobile detection should use useMobileOptimization hook',
          severity: 'low'
        });
      }
      
      // Check for touch target sizes
      if (content.includes('min-h-[') || content.includes('min-w-[')) {
        const matches = content.match(/min-h-\[(\d+)px\]|min-w-\[(\d+)px\]/g);
        if (matches) {
          matches.forEach(match => {
            const size = parseInt(match.match(/\d+/)[0]);
            if (size < 48) {
              issues.mobileWeb.push({
                file: file.replace(ROOT_DIR, ''),
                issue: `Touch target size ${size}px is below 48px minimum`,
                severity: 'medium'
              });
            }
          });
        }
      }
      
    } catch {
      // Skip files that can't be read
    }
  });
}

// Generate report
function generateReport() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = join(ROOT_DIR, `ATLAS_COMPREHENSIVE_SCAN_REPORT_${timestamp}.md`);
  
  let report = `# Atlas Comprehensive Codebase Scan Report\n\n`;
  report += `**Date:** ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;
  
  // Summary
  const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
  report += `## Summary\n\n`;
  report += `- **Total Issues Found:** ${totalIssues}\n`;
  report += `- **Code Quality:** ${issues.codeQuality.length}\n`;
  report += `- **Best Practices:** ${issues.bestPractices.length}\n`;
  report += `- **Security:** ${issues.security.length}\n`;
  report += `- **Performance:** ${issues.performance.length}\n`;
  report += `- **Architecture:** ${issues.architecture.length}\n`;
  report += `- **Database:** ${issues.database.length}\n`;
  report += `- **Mobile/Web:** ${issues.mobileWeb.length}\n\n`;
  report += `---\n\n`;
  
  // Code Quality
  if (issues.codeQuality.length > 0) {
    report += `## Code Quality Issues\n\n`;
    issues.codeQuality.forEach(issue => {
      report += `- **${issue.file}** (Line ${issue.line || 'N/A'}): ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Best Practices
  if (issues.bestPractices.length > 0) {
    report += `## Best Practices Issues\n\n`;
    issues.bestPractices.forEach(issue => {
      report += `- **${issue.file}**: ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Security
  if (issues.security.length > 0) {
    report += `## Security Issues\n\n`;
    issues.security.forEach(issue => {
      report += `- **${issue.file}**: ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Performance
  if (issues.performance.length > 0) {
    report += `## Performance Issues\n\n`;
    issues.performance.forEach(issue => {
      report += `- **${issue.file}**: ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Architecture
  if (issues.architecture.length > 0) {
    report += `## Architecture Issues\n\n`;
    issues.architecture.forEach(issue => {
      report += `- **${issue.file}**: ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Database
  if (issues.database.length > 0) {
    report += `## Database Issues\n\n`;
    issues.database.forEach(issue => {
      report += `- **${issue.file}**: ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Mobile/Web
  if (issues.mobileWeb.length > 0) {
    report += `## Mobile/Web Issues\n\n`;
    issues.mobileWeb.forEach(issue => {
      report += `- **${issue.file}**: ${issue.issue} [${issue.severity}]\n`;
    });
    report += `\n`;
  }
  
  // Conclusion
  report += `---\n\n`;
  report += `## Conclusion\n\n`;
  if (totalIssues === 0) {
    report += `✅ No issues found! Codebase is in excellent shape.\n`;
  } else {
    report += `Found ${totalIssues} issues across ${Object.keys(issues).length} categories.\n`;
    report += `Review and address issues based on severity (high > medium > low > info).\n`;
  }
  
  // Write report
  writeFileSync(reportPath, report);
  console.log(`\n✅ Scan complete! Report saved to: ${reportPath.replace(ROOT_DIR, '')}`);
  
  return reportPath;
}

// Main execution
async function main() {
  console.log('🔍 Starting Atlas Comprehensive Codebase Scan...\n');
  
  const srcDir = join(ROOT_DIR, 'src');
  const supabaseDir = join(ROOT_DIR, 'supabase');
  
  const files = [
    ...getAllFiles(srcDir),
    ...getAllFiles(supabaseDir)
  ];
  
  console.log(`Found ${files.length} files to scan\n`);
  
  // Run all scans
  scanCodeQuality(files);
  scanBestPractices(files);
  scanSecurity(files);
  scanPerformance(files);
  scanArchitecture(files);
  scanDatabase(files);
  scanMobileWeb(files);
  
  // Generate report
  generateReport(); // Report is saved to file, path logged in function
  
  // Print summary
  console.log('\n📊 Scan Summary:');
  console.log(`- Code Quality: ${issues.codeQuality.length} issues`);
  console.log(`- Best Practices: ${issues.bestPractices.length} issues`);
  console.log(`- Security: ${issues.security.length} issues`);
  console.log(`- Performance: ${issues.performance.length} issues`);
  console.log(`- Architecture: ${issues.architecture.length} issues`);
  console.log(`- Database: ${issues.database.length} issues`);
  console.log(`- Mobile/Web: ${issues.mobileWeb.length} issues`);
  
  process.exit(0);
}

main().catch(console.error);

