#!/usr/bin/env bash
# Atlas AI Auto-backup Script

BACKUP_DIR="$HOME/atlas-backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup: $BACKUP_DIR"

# Backup critical directories
cp -r src "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ No src directory"
cp -r config "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ No config directory"
cp package.json "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ No package.json"
cp .env.example "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ No .env.example"

echo "✅ Backup created: $BACKUP_DIR"

# Keep only last 10 backups
cd "$HOME/atlas-backups"
ls -t | tail -n +11 | xargs -r rm -rf

echo "🧹 Cleaned old backups (kept last 10)"
