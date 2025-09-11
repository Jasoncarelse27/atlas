# 🔗 Database Connection Information

## Project Details
- **Project Name**: atlas-ai-app
- **Project Ref**: rbwabemtucdkytvvpzvk
- **Region**: Southeast Asia (Singapore)
- **Status**: ✅ Linked and Ready

## Connection Strings

### For pgcli:
```bash
pgcli postgres://postgres:[YOUR_PASSWORD]@db.rbwabemtucdkytvvpzvk.supabase.co:5432/postgres
```

### For GitHub Secret (SUPABASE_DB_URL):
```
postgresql://postgres:[YOUR_PASSWORD]@db.rbwabemtucdkytvvpzvk.supabase.co:5432/postgres
```

### For GUI Tools:
- **Host**: `db.rbwabemtucdkytvvpzvk.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **Username**: `postgres`
- **Password**: `[Your database password]`

## Dashboard Links
- **Project Dashboard**: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk
- **Storage**: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/storage
- **Database Settings**: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/settings/database

## Next Steps
1. Create `backups` bucket in Storage dashboard
2. Add `SUPABASE_DB_URL` to GitHub secrets
3. Run `./scripts/supabase-sync.sh` to test
