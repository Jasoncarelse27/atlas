#!/bin/bash

# Auto-sync script for clean Git trees
# Runs every hour to sync with GitHub when working tree is clean

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="/Users/jasoncarelse/atlas"
LOG_FILE="$REPO_DIR/logs/auto-sync.log"
LOCK_FILE="$REPO_DIR/.auto-sync.lock"
MAX_SYNC_AGE=3600 # 1 hour in seconds

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if another sync is running
if [ -f "$LOCK_FILE" ]; then
    LOCK_AGE=$(($(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || echo 0)))
    if [ $LOCK_AGE -lt 300 ]; then # 5 minutes
        log "⚠️ Another sync is already running (lock file exists)"
        exit 0
    else
        log "🧹 Removing stale lock file"
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

log "🔄 Starting auto-sync check..."

# Change to repo directory
cd "$REPO_DIR"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log "❌ Not in a git repository"
    exit 1
fi

# Check if working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
    log "⚠️ Working tree is not clean, skipping sync"
    git status --porcelain | head -5 | while read line; do
        log "   $line"
    done
    exit 0
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
log "📍 Current branch: $CURRENT_BRANCH"

# Skip sync for feature branches
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "develop" ]]; then
    log "⚠️ Skipping sync for feature branch: $CURRENT_BRANCH"
    exit 0
fi

# Fetch latest changes
log "📥 Fetching latest changes from origin..."
git fetch origin

# Check if we're behind
BEHIND=$(git rev-list --count HEAD..origin/$CURRENT_BRANCH 2>/dev/null || echo 0)
AHEAD=$(git rev-list --count origin/$CURRENT_BRANCH..HEAD 2>/dev/null || echo 0)

log "📊 Status: $AHEAD ahead, $BEHIND behind origin/$CURRENT_BRANCH"

# Pull if we're behind
if [ "$BEHIND" -gt 0 ]; then
    log "📥 Pulling $BEHIND commits from origin/$CURRENT_BRANCH"
    if git pull origin $CURRENT_BRANCH; then
        log "✅ Successfully pulled latest changes"
    else
        log "❌ Failed to pull changes"
        exit 1
    fi
fi

# Push if we're ahead
if [ "$AHEAD" -gt 0 ]; then
    log "📤 Pushing $AHEAD local commits to origin"
    if git push origin $CURRENT_BRANCH; then
        log "✅ Successfully pushed local changes"
    else
        log "❌ Failed to push changes"
        exit 1
    fi
fi

# Check for rebase in progress
if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    log "⚠️ Rebase in progress detected - skipping sync"
    exit 0
fi

# Update last sync timestamp
echo "$(date +%s)" > "$REPO_DIR/.last-sync"

log "✅ Auto-sync completed successfully"

# Clean up old log entries (keep last 100 lines)
tail -n 100 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
