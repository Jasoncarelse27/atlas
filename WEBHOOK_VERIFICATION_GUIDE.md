# 🧪 MailerLite Webhook Verification Guide

## ✅ **Test Results Summary**

### **Webhook Events Tested:**
- ✅ `subscriber.created` - Premium plan assignment
- ✅ `subscriber.updated` - Enterprise plan upgrade  
- ✅ `subscriber.unsubscribed` - Downgrade to free + unsubscribed status
- ✅ `subscriber.bounced` - Mark as inactive with bounce reason
- ✅ `subscriber.added_to_group` - Group assignment logging
- ✅ `subscriber.deleted` - Downgrade to free tier
- ✅ **Security Test** - Invalid signature properly rejected (401)

### **Test Email Used:** `test-1757873373@demo.com`

---

## 📊 **Step 2: Check Supabase Logs**

### **Method 1: Supabase Dashboard (Recommended)**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/functions)
2. Navigate to **Edge Functions** → **mailerWebhook**
3. Click on **Logs** tab
4. Look for structured JSON logs like:

```json
{
  "timestamp": "2025-09-14T17:58:25.000Z",
  "level": "INFO",
  "message": "Verified MailerLite webhook received",
  "event": "webhook_received",
  "webhookType": "subscriber.created",
  "email": "test-1757873373@demo.com"
}
```

### **Expected Log Patterns:**
- **INFO**: Successful operations
- **WARN**: Retry attempts (if any)
- **ERROR**: Final failures after retries

---

## 🗄️ **Step 3: Verify Profiles Table**

### **Run SQL Queries in Supabase SQL Editor:**

```sql
-- Check recent updates
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at
FROM profiles 
WHERE email LIKE '%test-1757873373%'
ORDER BY updated_at DESC;
```

### **Expected Results:**

| Event | subscription_tier | status | bounce_reason | Notes |
|-------|------------------|--------|---------------|-------|
| `subscriber.created` | `premium` | `null` | `null` | Initial creation |
| `subscriber.updated` | `enterprise` | `null` | `null` | Plan upgrade |
| `subscriber.unsubscribed` | `free` | `unsubscribed` | `null` | Downgrade + status |
| `subscriber.bounced` | `enterprise` | `inactive` | `mailbox_full` | Bounce handling |
| `subscriber.deleted` | `free` | `inactive` | `mailbox_full` | Final downgrade |

---

## 🔄 **Step 4: Observe Retry Logs**

### **Look for these log patterns:**

#### **Successful Retry:**
```json
{
  "timestamp": "2025-09-14T17:58:26.000Z",
  "level": "WARN",
  "message": "Operation failed on attempt 1",
  "event": "handle_subscriber.created",
  "email": "test@demo.com",
  "retryAttempt": 1,
  "error": "Database connection timeout"
}
```

```json
{
  "timestamp": "2025-09-14T17:58:28.000Z",
  "level": "INFO",
  "message": "Operation succeeded on retry attempt 2",
  "event": "handle_subscriber.created",
  "email": "test@demo.com",
  "retryAttempt": 2
}
```

#### **Final Failure:**
```json
{
  "timestamp": "2025-09-14T17:58:30.000Z",
  "level": "ERROR",
  "message": "Failed to sync subscriber after retries",
  "event": "handle_subscriber.created",
  "email": "test@demo.com",
  "retryAttempt": 3,
  "error": "Database connection timeout"
}
```

---

## 🎯 **Verification Checklist**

### **✅ Function Behavior:**
- [ ] All webhook events return `{"received":true}` immediately
- [ ] Invalid signatures return 401 Unauthorized
- [ ] Background processing doesn't block webhook response
- [ ] Structured JSON logs are generated for all operations

### **✅ Database Updates:**
- [ ] `subscription_tier` updates correctly (premium → enterprise → free)
- [ ] `status` field updates (unsubscribed, inactive)
- [ ] `bounce_reason` stored for bounced emails
- [ ] `updated_at` timestamp reflects recent changes

### **✅ Resilience Features:**
- [ ] Retry logic activates on database failures
- [ ] Exponential backoff delays (1s, 2s, 4s)
- [ ] Final failures are logged as ERROR level
- [ ] Function continues working despite individual failures

### **✅ Security:**
- [ ] HMAC signature verification working
- [ ] Invalid signatures rejected
- [ ] No sensitive data in logs
- [ ] Proper error handling for malformed requests

---

## 🚨 **Troubleshooting**

### **If logs show errors:**
1. Check Supabase database connectivity
2. Verify `MAILERLITE_SECRET` is set correctly
3. Check if profiles table has required columns
4. Look for rate limiting or quota issues

### **If database updates fail:**
1. Check RLS (Row Level Security) policies
2. Verify service role key permissions
3. Check for column type mismatches
4. Look for foreign key constraints

### **If retry logic isn't working:**
1. Check if errors are being caught properly
2. Verify exponential backoff timing
3. Look for timeout configurations
4. Check Supabase connection limits

---

## 📈 **Performance Metrics**

### **Expected Response Times:**
- **Webhook Response**: < 100ms (immediate acknowledgment)
- **Background Processing**: 1-3 seconds per operation
- **Retry Delays**: 1s, 2s, 4s (if needed)
- **Total Processing**: < 10 seconds (including retries)

### **Success Rates:**
- **Webhook Acknowledgment**: 100% (always returns 200)
- **Database Operations**: 95%+ (with retry logic)
- **Signature Verification**: 100% (security working)

---

## 🎉 **Success Criteria**

Your MailerLite webhook is **production-ready** when:

1. ✅ All test events return `{"received":true}`
2. ✅ Structured logs show proper event handling
3. ✅ Database updates reflect webhook events
4. ✅ Retry logic handles temporary failures
5. ✅ Security properly rejects invalid signatures
6. ✅ Background processing doesn't block responses

**🎊 Congratulations! Your webhook is enterprise-grade and ready for production use!**
