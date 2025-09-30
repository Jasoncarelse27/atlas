# 🗄️ Database Migration Guide - Subscription Columns

## 📋 **Migration Overview**

**Migration ID**: `20250914_add_subscription_columns`  
**Date**: September 14, 2025  
**Purpose**: Add MailerLite webhook support to profiles table  
**Risk Level**: 🟢 **LOW** (Additive changes only)

---

## 🚀 **Forward Migration Changes**

### **New Columns Added:**
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
```

### **New Indexes Created:**
- `idx_profiles_subscription_tier` - For subscription tier queries
- `idx_profiles_status` - For status filtering
- `idx_profiles_updated_at` - For recent updates

### **Data Updates:**
- Existing profiles get default values: `subscription_tier = 'free'`, `status = 'active'`
- No data loss - all changes are additive

---

## 🔄 **Rollback Migration**

### **Rollback Changes:**
```sql
-- Drop indexes first
DROP INDEX IF EXISTS idx_profiles_subscription_tier;
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_updated_at;

-- Drop columns
ALTER TABLE profiles
  DROP COLUMN IF EXISTS bounce_reason,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS subscription_tier;
```

### **Rollback Safety:**
- ✅ **Safe**: Uses `IF EXISTS` to prevent errors
- ✅ **Complete**: Removes all added columns and indexes
- ⚠️ **Data Loss**: Subscription data will be permanently deleted

---

## 🛡️ **Safety Features**

### **Migration Safety:**
- ✅ **Idempotent**: Uses `IF NOT EXISTS` - can run multiple times safely
- ✅ **Additive Only**: No existing data is modified or deleted
- ✅ **Default Values**: New columns have sensible defaults
- ✅ **Indexed**: Performance optimized with proper indexes

### **Rollback Safety:**
- ✅ **Conditional**: Uses `IF EXISTS` to prevent errors
- ✅ **Complete**: Removes all migration changes
- ✅ **Logged**: Rollback actions are logged for audit

---

## 🚀 **Deployment Workflow**

### **1. Staging Deployment (Automatic)**
```yaml
# Triggered on PR to main
- Pull Request → Runs migration check workflow
- Tests forward migration → rollback → forward
- Validates syntax and safety
- Generates migration report
```

### **2. Production Deployment (Automatic)**
```yaml
# Triggered on merge to main
- Merge to main → CI/CD pipeline runs
- Applies forward migration to production
- Deploys updated webhook function
- Sends deployment notification
```

### **3. Manual Rollback (On-Demand)**
```yaml
# Triggered manually via GitHub Actions
- Go to Actions → Manual Database Rollback
- Select environment (production/staging)
- Type "ROLLBACK" to confirm
- Creates backup → executes rollback → verifies
```

---

## 📊 **Migration Testing**

### **Automated Testing:**
- ✅ **Syntax Validation**: SQL syntax checked
- ✅ **Safety Checks**: IF NOT EXISTS/IF EXISTS validation
- ✅ **Forward Test**: Migration applied successfully
- ✅ **Rollback Test**: Rollback executed successfully
- ✅ **Re-apply Test**: Migration re-applied after rollback

### **Manual Testing:**
```bash
# Test migration locally
./test-schema-and-webhook.sh

# Verify columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('subscription_tier', 'status', 'bounce_reason');
```

---

## 🚨 **Rollback Procedures**

### **When to Rollback:**
- ❌ **Performance Issues**: Migration causes slow queries
- ❌ **Application Errors**: Code breaks due to schema changes
- ❌ **Data Corruption**: Unexpected data issues
- ❌ **Security Concerns**: Migration introduces vulnerabilities

### **How to Rollback:**

#### **Option 1: GitHub Actions (Recommended)**
1. Go to [GitHub Actions](https://github.com/Jasoncarelse27/atlas/actions)
2. Click "Manual Database Rollback" workflow
3. Click "Run workflow"
4. Fill in parameters:
   - **Migration name**: `20250914_subscription_columns`
   - **Environment**: `production` or `staging`
   - **Confirm rollback**: Type `ROLLBACK`
5. Click "Run workflow"

#### **Option 2: Manual SQL (Emergency)**
```sql
-- Run in Supabase SQL Editor
DROP INDEX IF EXISTS idx_profiles_subscription_tier;
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_updated_at;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS bounce_reason,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS subscription_tier;
```

---

## 📈 **Monitoring & Verification**

### **Post-Migration Checks:**
```sql
-- Verify columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('subscription_tier', 'status', 'bounce_reason');

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE 'idx_profiles_%';

-- Verify data
SELECT 
    subscription_tier,
    status,
    COUNT(*) as count
FROM profiles 
GROUP BY subscription_tier, status;
```

### **Webhook Testing:**
```bash
# Test MailerLite webhook
./test-schema-and-webhook.sh

# Expected results:
# - subscription_tier: 'premium'
# - status: 'active' or 'inactive'
# - bounce_reason: null or bounce reason
```

---

## 📧 **Notifications**

### **Deployment Notifications:**
- ✅ **Success**: Email to `admin@otiumcreations.com`
- ✅ **Failure**: Email with error details
- ✅ **Rollback**: Email with rollback confirmation

### **Monitoring Alerts:**
- 🔍 **Database Performance**: Query time monitoring
- 🔍 **Webhook Health**: Function execution monitoring
- 🔍 **Error Rates**: Failed webhook processing

---

## 🎯 **Success Criteria**

### **Migration Success:**
- ✅ **Columns Added**: All 3 columns exist with correct types
- ✅ **Indexes Created**: Performance indexes in place
- ✅ **Data Populated**: Existing profiles have default values
- ✅ **Webhook Working**: MailerLite events processed correctly
- ✅ **No Errors**: No application or database errors

### **Rollback Success:**
- ✅ **Columns Removed**: All added columns dropped
- ✅ **Indexes Removed**: All added indexes dropped
- ✅ **Application Working**: No broken functionality
- ✅ **Backup Created**: Database backup available
- ✅ **Logs Updated**: Rollback logged for audit

---

## 📚 **Related Files**

### **Migration Files:**
- `supabase/migrations/20250914_add_subscription_columns.sql` - Forward migration
- `supabase/migrations/20250914_rollback_subscription_columns.sql` - Rollback migration

### **Workflows:**
- `.github/workflows/db-migration-check.yml` - Migration testing
- `.github/workflows/manual-rollback.yml` - Manual rollback

### **Testing:**
- `test-schema-and-webhook.sh` - Webhook testing
- `verify-schema-test.sql` - SQL verification queries

### **Documentation:**
- `MAILERLITE_WEBHOOK_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `MIGRATION_GUIDE.md` - This migration guide

---

## 🆘 **Emergency Contacts**

### **Database Issues:**
- **Primary**: Database team via GitHub Issues
- **Emergency**: Direct database access via Supabase Dashboard

### **Application Issues:**
- **Primary**: Development team via GitHub Issues
- **Emergency**: Application logs via Supabase Edge Functions

### **Rollback Issues:**
- **Primary**: Use GitHub Actions manual rollback
- **Emergency**: Direct SQL execution in Supabase SQL Editor

---

## 🎉 **Migration Complete!**

Once this migration is applied, your Atlas application will have:
- ✅ **Full MailerLite Integration**: Webhook events sync to database
- ✅ **Subscription Management**: Track user subscription tiers
- ✅ **Status Tracking**: Monitor user engagement status
- ✅ **Bounce Handling**: Track email delivery issues
- ✅ **Production Ready**: Robust error handling and monitoring

**🚀 Your MailerLite webhook integration is now enterprise-grade!**
