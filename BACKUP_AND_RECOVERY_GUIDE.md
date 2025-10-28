# 🛡️ Atlas Backup & Recovery Guide

## Automatic Backups

### Supabase (Primary Data)
- ✅ Daily automatic backups
- ✅ 7-day retention (Free tier)
- ✅ Point-in-time recovery available

### User's Browser (Local Cache)
- ✅ IndexedDB persists conversations
- ✅ Automatic sync with server
- ✅ Offline access to recent chats

## Manual Backup Options

### For Users:
```javascript
// Paste in browser console (F12)

// Atlas IndexedDB Export Function
async function exportAtlasData() {
  const db = await window.atlasDB;
  const data = {
    conversations: await db.conversations.toArray(),
    messages: await db.messages.toArray(),
    ritualCompletions: await db.ritualCompletions?.toArray() || [],
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atlas-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


// Run the export
exportAtlasData();
```

### For Admins:
1. Supabase Dashboard → Database → Backups
2. Download latest backup
3. Store securely offsite

## Recovery Procedures

### Scenario 1: User Reports Missing Data
1. Check user's tier and limits
2. Verify sync status in logs
3. Run manual sync: `conversationSyncService.fullSync(userId)`
4. If still missing, check Supabase backups

### Scenario 2: Database Corruption
1. Stop all services immediately
2. Access Supabase dashboard
3. Restore from most recent backup
4. Verify data integrity
5. Resume services

### Scenario 3: Complete Data Loss
1. DO NOT PANIC
2. Contact Supabase support immediately
3. They maintain backups beyond user access
4. Restore from GitHub + Supabase backup
5. Notify affected users

## Backup Schedule

- **Supabase**: Daily at 2 AM UTC
- **Recommended Manual**: Weekly on Sundays
- **Before Major Updates**: Always

## Contact for Emergencies

- Technical: admin@otiumcreations.com
- Supabase Support: support@supabase.com
- GitHub Repo: github.com/Jasoncarelse27/atlas

---

Last Updated: 2025-10-28T11:56:29.676Z
