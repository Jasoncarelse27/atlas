#!/bin/bash

# VS Code Performance Monitor for Atlas Project
# Run this script to check current performance status

set -e

echo "📊 VS Code Performance Monitor for Atlas"
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

echo
print_status "System Performance Check"
echo "-----------------------------"

# 1. CPU Usage
CPU_USAGE=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
print_status "CPU Usage: ${CPU_USAGE}%"
if [ "$CPU_USAGE" -gt 80 ]; then
    print_warning "High CPU usage detected"
else
    print_success "CPU usage is normal"
fi

# 2. Memory Usage
MEMORY_INFO=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
TOTAL_MEMORY=$(sysctl hw.memsize | awk '{print $2}')
FREE_MEMORY=$((MEMORY_INFO * 4096))
MEMORY_USAGE=$((100 - (FREE_MEMORY * 100 / TOTAL_MEMORY)))
print_status "Memory Usage: ${MEMORY_USAGE}%"
if [ "$MEMORY_USAGE" -gt 85 ]; then
    print_warning "High memory usage detected"
else
    print_success "Memory usage is normal"
fi

# 3. Disk Space
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
print_status "Disk Usage: ${DISK_USAGE}%"
if [ "$DISK_USAGE" -gt 90 ]; then
    print_warning "Low disk space"
else
    print_success "Disk space is adequate"
fi

echo
print_status "VS Code Performance Check"
echo "-------------------------------"

# 4. VS Code Processes
VSCODE_PROCESSES=$(ps aux | grep -i "code" | grep -v grep | wc -l)
print_status "VS Code Processes: $VSCODE_PROCESSES"
if [ "$VSCODE_PROCESSES" -gt 8 ]; then
    print_warning "Too many VS Code processes"
else
    print_success "VS Code processes look normal"
fi

# 5. VS Code Memory Usage
VSCODE_MEMORY=$(ps aux | grep -i "code" | grep -v grep | awk '{sum += $6} END {print sum/1024}')
if [ -n "$VSCODE_MEMORY" ] && [ "$VSCODE_MEMORY" != "0" ]; then
    print_status "VS Code Memory Usage: ${VSCODE_MEMORY}MB"
    if (( $(echo "$VSCODE_MEMORY > 2000" | bc -l) )); then
        print_warning "VS Code using high memory"
    else
        print_success "VS Code memory usage is normal"
    fi
else
    print_warning "Could not determine VS Code memory usage"
fi

# 6. File Watchers
FILE_WATCHERS=$(lsof | grep "Code Helper" | wc -l)
print_status "File Watchers: $FILE_WATCHERS"
if [ "$FILE_WATCHERS" -gt 1000 ]; then
    print_warning "High number of file watchers"
else
    print_success "File watchers are normal"
fi

# 7. TypeScript Server
TSSERVER_PROCESSES=$(ps aux | grep "tsserver" | grep -v grep | wc -l)
print_status "TypeScript Server Processes: $TSSERVER_PROCESSES"
if [ "$TSSERVER_PROCESSES" -gt 2 ]; then
    print_warning "Multiple TypeScript servers running"
else
    print_success "TypeScript server status is normal"
fi

echo
print_status "Project Performance Check"
echo "------------------------------"

# 8. Node Modules Size
if [ -d "node_modules" ]; then
    NODE_MODULES_SIZE=$(du -sh node_modules | awk '{print $1}')
    print_status "Node Modules Size: $NODE_MODULES_SIZE"
else
    print_warning "Node modules not found"
fi

# 9. Build Artifacts
if [ -d "dist" ]; then
    DIST_SIZE=$(du -sh dist | awk '{print $1}')
    print_status "Build Artifacts Size: $DIST_SIZE"
else
    print_success "No build artifacts found"
fi

# 10. Git Repository Size
GIT_SIZE=$(du -sh .git | awk '{print $1}' 2>/dev/null || echo "N/A")
print_status "Git Repository Size: $GIT_SIZE"

# 11. Large Files Check
LARGE_FILES_COUNT=$(find . -type f -size +50M -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | wc -l)
print_status "Large Files (>50MB): $LARGE_FILES_COUNT"
if [ "$LARGE_FILES_COUNT" -gt 5 ]; then
    print_warning "Many large files detected"
fi

echo
print_status "Performance Recommendations"
echo "--------------------------------"

# Generate recommendations based on findings
RECOMMENDATIONS=()

if [ "$CPU_USAGE" -gt 80 ]; then
    RECOMMENDATIONS+=("Consider closing other applications to reduce CPU load")
fi

if [ "$MEMORY_USAGE" -gt 85 ]; then
    RECOMMENDATIONS+=("Restart VS Code to free up memory")
fi

if [ "$DISK_USAGE" -gt 90 ]; then
    RECOMMENDATIONS+=("Clean up disk space by removing unnecessary files")
fi

if [ "$VSCODE_PROCESSES" -gt 8 ]; then
    RECOMMENDATIONS+=("Restart VS Code to reduce process count")
fi

if [ "$FILE_WATCHERS" -gt 1000 ]; then
    RECOMMENDATIONS+=("Restart VS Code to reset file watchers")
fi

if [ "$TSSERVER_PROCESSES" -gt 2 ]; then
    RECOMMENDATIONS+=("Restart TypeScript server: Cmd+Shift+P > 'TypeScript: Restart TS Server'")
fi

if [ "$LARGE_FILES_COUNT" -gt 5 ]; then
    RECOMMENDATIONS+=("Consider moving large files to external storage")
fi

# Default recommendations
RECOMMENDATIONS+=("Run 'npm run dev' to test development server performance")
RECOMMENDATIONS+=("Check VS Code extensions for performance impact")
RECOMMENDATIONS+=("Monitor Activity Monitor for high CPU processes")

# Display recommendations
if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
    for i in "${!RECOMMENDATIONS[@]}"; do
        echo "$((i+1)). ${RECOMMENDATIONS[$i]}"
    done
else
    print_success "No specific recommendations at this time"
fi

echo
print_status "Quick Performance Commands"
echo "-------------------------------"
echo "• Restart VS Code: Cmd+Shift+P > 'Developer: Reload Window'"
echo "• Restart TS Server: Cmd+Shift+P > 'TypeScript: Restart TS Server'"
echo "• Clear VS Code cache: Run maintenance script"
echo "• Check Activity Monitor: Open Activity Monitor app"
echo "• Monitor processes: ps aux | grep -i code"

echo
print_status "Performance check completed at $(date)"
