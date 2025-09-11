# ✅ Supabase Setup - Next Steps

## 🎯 What's Been Completed

### ✅ Database Tools Installed
- **pgcli**: Command-line PostgreSQL client installed via Homebrew
- **Ready for GUI tools**: You can now install TablePlus, pgAdmin, or Beekeeper Studio

### ✅ Supabase Project Linked
- **Project**: atlas-ai-app (rbwabemtucdkytvvpzvk)
- **Region**: Southeast Asia (Singapore)
- **Status**: Successfully linked and authenticated

## 🔄 Remaining Setup Steps

### 1. Create Backup Bucket (Manual Step)
Since the Supabase CLI doesn't have a direct bucket creation command, you need to create it through the dashboard:

1. **Go to**: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/storage
2. **Click**: "New bucket"
3. **Name**: `backups`
4. **Set**: Public bucket (for automated uploads)
5. **Create**: The bucket

### 2. Add GitHub Secret
1. **Go to**: GitHub → Your Repository → Settings → Secrets and variables → Actions
2. **Click**: "New repository secret"
3. **Name**: `SUPABASE_DB_URL`
4. **Value**: Your database connection string (get from Supabase dashboard)

### 3. Test the Sync Script
Once the bucket is created, run:
```bash
./scripts/supabase-sync.sh
```

## 🛠️ Database Connection Info

### For pgcli:
```bash
pgcli postgres://postgres:[YOUR_PASSWORD]@db.rbwabemtucdkytvvpzvk.supabase.co:5432/postgres
```

### For GUI Tools:
- **Host**: db.rbwabemtucdkytvvpzvk.supabase.co
- **Port**: 5432
- **Database**: postgres
- **Username**: postgres
- **Password**: [Your database password]

## 🎉 Ready to Go!

Once you complete steps 1-2 above, your Supabase sync system will be fully operational with:
- ✅ Automated backups (local + cloud)
- ✅ Schema synchronization
- ✅ Backup rotation
- ✅ CI/CD integration
- ✅ Rollback protection

## 📋 Quick Commands

```bash
# Test database connection
pgcli postgres://postgres:[PASSWORD]@db.rbwabemtucdkytvvpzvk.supabase.co:5432/postgres

# Run sync script
./scripts/supabase-sync.sh

# Check project status
supabase status
```
