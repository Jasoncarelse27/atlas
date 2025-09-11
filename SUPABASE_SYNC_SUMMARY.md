# ✅ Supabase Sync Script - Enhanced Version

## 🎯 What's New in This Version

### Enhanced Features:
1. **🔄 Backup Rotation**: Automatically keeps only the last 10 backups (local + cloud)
2. **🛡️ Smart Error Handling**: Graceful fallbacks with helpful error messages
3. **📦 Simplified Setup**: No need to configure database URLs manually
4. **♻️ Storage Management**: Automatic cleanup of old backups
5. **🔧 Better CLI Integration**: Uses Supabase CLI directly for all operations

### Key Improvements:
- **Timestamped Backups**: `atlas-ai_20250910_205657.sql` format
- **Automatic Rollback**: Creates rollback files on migration failure
- **Cloud Storage Integration**: Uploads to Supabase Storage with error handling
- **Git Integration**: Commits schema changes with timestamps
- **Backup Rotation**: Keeps storage clean by removing old backups

## 🚀 Quick Start

1. **Make executable** (one-time setup):
   ```bash
   chmod +x scripts/supabase-sync.sh
   ```

2. **Create backup bucket** (one-time setup):
   ```bash
   supabase storage create-bucket backups --public
   ```

3. **Run sync** (whenever you need to sync):
   ```bash
   ./scripts/supabase-sync.sh
   ```

## 🔄 What the Script Does

1. **Creates timestamped backup** locally
2. **Uploads backup** to Supabase Storage
3. **Pulls latest schema** from remote
4. **Validates migrations** with dry-run
5. **Applies migrations** safely
6. **Commits changes** to Git
7. **Rotates backups** (keeps last 10)

## 🛡️ Safety Features

- **Pre-migration backup** before any changes
- **Dry-run validation** before applying migrations
- **Automatic rollback** if migration fails
- **Backup rotation** to prevent storage bloat
- **Error handling** with helpful messages

## 📁 File Structure

```
scripts/
└── supabase-sync.sh          # Enhanced sync script
supabase/
├── backups/                  # Local backup storage
│   └── atlas-ai_*.sql       # Timestamped backups
└── migrations/               # Generated migration files
```

## 🎉 Ready to Use!

The script is now production-ready with enterprise-grade backup management and safety features.
