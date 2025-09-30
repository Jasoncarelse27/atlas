# 🛡️ Atlas Dual Safety Net - Upload Retry System

## 🎯 **System Overview**

Atlas now has a **bulletproof upload system** with three layers of protection:

1. **Dexie Flush**: Local uploads auto-sync when backend comes online
2. **Edge Function Retry**: Server-side retries for failed uploads  
3. **Cron Safety Net**: Automatic retries every 10 minutes

## 📋 **Deployment Checklist**

### **Step 1: Database Setup**

Run these SQL scripts in **Supabase SQL Editor**:

1. **Create retry_logs table**:
   ```sql
   -- Run: create_retry_logs_table.sql
   ```

2. **Enable pg_cron and schedule retries**:
   ```sql
   -- Run: setup_cron_schedule_with_key.sql
   ```

### **Step 2: Deploy Edge Function**

```bash
# Deploy the updated Edge Function
supabase functions deploy retryFailedUploads
```

### **Step 3: Frontend Updates**

The following files have been updated:
- ✅ `src/services/syncService.ts` - Dexie flush + Edge Function trigger
- ✅ `src/App.tsx` - Debounced backend sync hook
- ✅ `supabase/functions/retryFailedUploads/index.ts` - Enhanced with logging

### **Step 4: Install Dependencies**

```bash
npm install lodash @types/lodash
```

## 🔄 **How It Works**

### **Triple Safety Net**

1. **User Uploads File** → Stored in Dexie if offline
2. **Backend Comes Online** → `syncPendingUploads()` flushes Dexie + triggers Edge Function
3. **Every 10 Minutes** → Cron job runs Edge Function for any missed uploads
4. **All Retries Logged** → Complete audit trail in `retry_logs` table

### **Retry Sources**

- **`dexie-sync`**: User's local uploads being synced
- **`edge-retry`**: Manual Edge Function calls
- **`cron`**: Scheduled automatic retries

## 📊 **Monitoring & Analytics**

### **Dashboard Queries**

Run these in **Supabase SQL Editor** for insights:

```sql
-- 7-Day Retry Health Report
SELECT
  source,
  COUNT(*) as runs,
  SUM(attempted_count) as total_attempted,
  SUM(success_count) as total_success,
  SUM(failed_count) as total_failed,
  ROUND((SUM(success_count)::float / NULLIF(SUM(attempted_count), 0)) * 100, 2) as success_rate_percent
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source;
```

### **Key Metrics**

- **Success Rate**: % of uploads that succeed after retry
- **Retry Frequency**: How often each source triggers
- **User Impact**: Which users need the most retries
- **System Health**: Overall upload reliability

## 🧪 **Testing**

### **Test Offline Uploads**

1. **Disconnect internet**
2. **Upload a file** → Should be cached in Dexie
3. **Reconnect internet** → Should auto-sync within 30 seconds
4. **Check `retry_logs`** → Should see `dexie-sync` entry

### **Test Cron Retries**

1. **Manually set upload status to `pending`** in `attachments` table
2. **Wait up to 10 minutes** → Cron should retry automatically
3. **Check `retry_logs`** → Should see `cron` entry

### **Test Edge Function**

```bash
# Manual trigger
curl -X POST https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/retryFailedUploads \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual-test"}'
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Cron not running**: Check `pg_cron` extension is enabled
2. **Edge Function failing**: Check service role key permissions
3. **Dexie not syncing**: Check backend connection in browser console
4. **No retry logs**: Check RLS policies on `retry_logs` table

### **Debug Commands**

```sql
-- Check cron jobs
SELECT * FROM cron.job WHERE jobname = 'retry-failed-uploads';

-- Check recent retry logs
SELECT * FROM retry_logs ORDER BY created_at DESC LIMIT 10;

-- Check pending uploads
SELECT * FROM attachments WHERE status = 'pending';
```

## 🎯 **Success Criteria**

✅ **Uploads never lost** - Even if user goes offline  
✅ **Automatic recovery** - No manual intervention needed  
✅ **Complete audit trail** - Every retry logged and trackable  
✅ **Performance monitoring** - Success rates and failure patterns visible  
✅ **Scalable system** - Handles high volume with cron safety net  

## 🔮 **Future Enhancements**

- **Retry backoff**: Exponential delays for failed retries
- **User notifications**: Alert users when uploads are retrying
- **Analytics dashboard**: Visual charts for retry metrics
- **Auto-cleanup**: Remove old retry logs after 30 days
- **Health alerts**: Notify admins of high failure rates

---

**🎉 Atlas now has enterprise-grade upload reliability!**
