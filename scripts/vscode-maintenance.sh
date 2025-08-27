#!/bin/bash

# VS Code Maintenance Script for Atlas Project
# Run this script monthly to keep VS Code optimized

set -e

echo "🧹 VS Code Maintenance Script for Atlas"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the Atlas project directory
if [ ! -f "package.json" ] || [ ! -f "vite.config.ts" ]; then
    print_error "Please run this script from the Atlas project root directory"
    exit 1
fi

print_status "Starting VS Code maintenance..."

# 1. Clean build artifacts
print_status "Cleaning build artifacts..."
if [ -d "dist" ]; then
    rm -rf dist
    print_success "Removed dist directory"
fi

if [ -d "coverage" ]; then
    rm -rf coverage
    print_success "Removed coverage directory"
fi

if [ -d ".vite" ]; then
    rm -rf .vite
    print_success "Removed .vite directory"
fi

# 2. Clear npm cache
print_status "Clearing npm cache..."
npm cache clean --force
print_success "NPM cache cleared"

# 3. Clear TypeScript cache
print_status "Clearing TypeScript cache..."
if [ -d "$HOME/Library/Caches/typescript" ]; then
    rm -rf "$HOME/Library/Caches/typescript"
    print_success "TypeScript cache cleared"
else
    print_warning "TypeScript cache directory not found"
fi

# 4. Clear VS Code cache
print_status "Clearing VS Code cache..."
VSCODE_CACHE_DIR="$HOME/Library/Application Support/Code/Cache"
if [ -d "$VSCODE_CACHE_DIR" ]; then
    rm -rf "$VSCODE_CACHE_DIR"/*
    print_success "VS Code cache cleared"
else
    print_warning "VS Code cache directory not found"
fi

# 5. Clear VS Code User Data (optional - more aggressive)
read -p "Do you want to clear VS Code User Data? This will reset some settings (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Clearing VS Code User Data..."
    VSCODE_USER_DATA="$HOME/Library/Application Support/Code/User"
    if [ -d "$VSCODE_USER_DATA" ]; then
        # Backup important settings
        if [ -f "$VSCODE_USER_DATA/settings.json" ]; then
            cp "$VSCODE_USER_DATA/settings.json" "$VSCODE_USER_DATA/settings.json.backup"
            print_success "Backed up VS Code settings"
        fi
        
        # Clear workspace storage
        WORKSPACE_STORAGE="$HOME/Library/Application Support/Code/User/workspaceStorage"
        if [ -d "$WORKSPACE_STORAGE" ]; then
            rm -rf "$WORKSPACE_STORAGE"/*
            print_success "VS Code workspace storage cleared"
        fi
    fi
fi

# 6. Check for outdated dependencies
print_status "Checking for outdated dependencies..."
OUTDATED=$(npm outdated --depth=0 2>/dev/null || true)
if [ -n "$OUTDATED" ]; then
    print_warning "Outdated dependencies found:"
    echo "$OUTDATED"
    read -p "Do you want to update dependencies? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Updating dependencies..."
        npm update
        print_success "Dependencies updated"
    fi
else
    print_success "All dependencies are up to date"
fi

# 7. Run security audit
print_status "Running security audit..."
npm audit --audit-level=moderate || {
    print_warning "Security vulnerabilities found. Run 'npm audit fix' to fix them."
}

# 8. Check disk space
print_status "Checking disk space..."
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    print_warning "Disk usage is high: ${DISK_USAGE}%"
    print_status "Consider cleaning up large files or moving them to external storage"
else
    print_success "Disk usage is healthy: ${DISK_USAGE}%"
fi

# 9. Check for large files
print_status "Checking for large files (>100MB)..."
LARGE_FILES=$(find . -type f -size +100M -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null || true)
if [ -n "$LARGE_FILES" ]; then
    print_warning "Large files found:"
    echo "$LARGE_FILES"
    print_status "Consider compressing or moving these files"
else
    print_success "No large files found"
fi

# 10. Check VS Code processes
print_status "Checking VS Code processes..."
VSCODE_PROCESSES=$(ps aux | grep -i "code" | grep -v grep | wc -l)
if [ "$VSCODE_PROCESSES" -gt 5 ]; then
    print_warning "Multiple VS Code processes running: $VSCODE_PROCESSES"
    print_status "Consider restarting VS Code to free up resources"
else
    print_success "VS Code processes look normal: $VSCODE_PROCESSES"
fi

# 11. Check file watchers
print_status "Checking file watchers..."
FILE_WATCHERS=$(lsof | grep "Code Helper" | wc -l)
if [ "$FILE_WATCHERS" -gt 1000 ]; then
    print_warning "High number of file watchers: $FILE_WATCHERS"
    print_status "Consider restarting VS Code or reducing watched files"
else
    print_success "File watchers look normal: $FILE_WATCHERS"
fi

# 12. Performance recommendations
echo
print_status "Performance Recommendations:"
echo "1. Restart VS Code: Cmd+Shift+P > 'Developer: Reload Window'"
echo "2. Restart TypeScript server: Cmd+Shift+P > 'TypeScript: Restart TS Server'"
echo "3. Disable unused extensions temporarily"
echo "4. Monitor Activity Monitor for high CPU processes"
echo "5. Consider increasing VS Code memory limit if needed"

# 13. Final cleanup
print_status "Running final cleanup..."
npm run lint --silent || print_warning "Linting issues found"
npm run type-check --silent || print_warning "TypeScript issues found"

echo
print_success "VS Code maintenance completed!"
echo
print_status "Next steps:"
echo "1. Restart VS Code"
echo "2. Install any pending extension updates"
echo "3. Run 'npm run dev' to test the development server"
echo "4. Check that IntelliSense is working properly"

echo
print_status "Maintenance completed at $(date)"
