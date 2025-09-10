#!/bin/bash

# Watchdog script to monitor for rebase-in-progress sessions
# Alerts user when rebase operations are detected

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="/Users/jasoncarelse/atlas"
LOG_FILE="$REPO_DIR/logs/watchdog-rebase.log"
ALERT_FILE="$REPO_DIR/.rebase-alert"
CHECK_INTERVAL=30 # seconds

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Alert function
alert() {
    local message="$1"
    log "🚨 ALERT: $message"
    
    # Show system notification (macOS)
    if command -v osascript >/dev/null 2>&1; then
        osascript -e "display notification \"$message\" with title \"Atlas AI - Rebase Alert\""
    fi
    
    # Show terminal alert
    echo -e "${RED}🚨 REBASE ALERT: $message${NC}"
    
    # Create alert file for other scripts to check
    echo "$(date): $message" > "$ALERT_FILE"
}

# Check for rebase in progress
check_rebase() {
    cd "$REPO_DIR"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        return 0
    fi
    
    # Check for rebase directories
    if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
        # Get rebase information
        local rebase_type="unknown"
        local rebase_step="unknown"
        
        if [ -d ".git/rebase-merge" ]; then
            rebase_type="merge"
            if [ -f ".git/rebase-merge/msgnum" ] && [ -f ".git/rebase-merge/end" ]; then
                local current=$(cat .git/rebase-merge/msgnum 2>/dev/null || echo "0")
                local total=$(cat .git/rebase-merge/end 2>/dev/null || echo "0")
                rebase_step="$current/$total"
            fi
        elif [ -d ".git/rebase-apply" ]; then
            rebase_type="apply"
            if [ -f ".git/rebase-apply/next" ] && [ -f ".git/rebase-apply/last" ]; then
                local current=$(cat .git/rebase-apply/next 2>/dev/null || echo "0")
                local total=$(cat .git/rebase-apply/last 2>/dev/null || echo "0")
                rebase_step="$current/$total"
            fi
        fi
        
        # Check if this is a new rebase (no alert file or different content)
        local current_alert="rebase-$rebase_type-$rebase_step"
        local last_alert=""
        
        if [ -f "$ALERT_FILE" ]; then
            last_alert=$(cat "$ALERT_FILE" | grep -o "rebase-[^-]*-[^-]*" | tail -1)
        fi
        
        if [ "$current_alert" != "$last_alert" ]; then
            alert "Rebase in progress: $rebase_type (step $rebase_step)"
        fi
        
        return 1
    fi
    
    # Clean up alert file if no rebase
    if [ -f "$ALERT_FILE" ]; then
        rm -f "$ALERT_FILE"
        log "✅ Rebase completed, alert cleared"
    fi
    
    return 0
}

# Check for merge conflicts
check_conflicts() {
    cd "$REPO_DIR"
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        return 0
    fi
    
    # Check for unmerged files
    local conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null | wc -l)
    if [ "$conflicts" -gt 0 ]; then
        local conflict_files=$(git diff --name-only --diff-filter=U 2>/dev/null | head -3 | tr '\n' ' ')
        alert "Merge conflicts detected: $conflicts files ($conflict_files...)"
        return 1
    fi
    
    return 0
}

# Check for detached HEAD
check_detached_head() {
    cd "$REPO_DIR"
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        return 0
    fi
    
    if git symbolic-ref HEAD >/dev/null 2>&1; then
        return 0 # Not detached
    fi
    
    local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    alert "Detached HEAD detected at commit $commit"
    return 1
}

# Main watchdog loop
main() {
    log "🐕 Starting rebase watchdog (checking every ${CHECK_INTERVAL}s)"
    
    while true; do
        # Check for rebase
        if ! check_rebase; then
            sleep $CHECK_INTERVAL
            continue
        fi
        
        # Check for conflicts
        if ! check_conflicts; then
            sleep $CHECK_INTERVAL
            continue
        fi
        
        # Check for detached HEAD
        if ! check_detached_head; then
            sleep $CHECK_INTERVAL
            continue
        fi
        
        # All checks passed
        sleep $CHECK_INTERVAL
    done
}

# Handle script interruption
trap 'log "🛑 Watchdog stopped"; exit 0' INT TERM

# Run main function
main
