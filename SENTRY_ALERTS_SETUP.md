# 🔔 Sentry Alerts & Monitoring Setup Guide

**Complete guide to configure Sentry dashboard for production monitoring**

---

## 📊 **What's Already Implemented**

✅ **Error Rate Tracking** (Automatic)
- Tracks errors per 5min/15min/1hour
- Auto-alerts if thresholds exceeded:
  - 10 errors in 5 minutes = HIGH ERROR RATE
  - 25 errors in 15 minutes = ELEVATED ERROR RATE
  - 50 errors in 1 hour = ERROR RATE ALERT

✅ **Performance Monitoring** (Automatic)
- API response times tracked
- Slow operations detected (>2s = warning, >5s = critical)
- Memory usage monitored every 30s

✅ **PII Masking** (Automatic)
- Email, phone, SSN, credit cards masked
- Auth tokens redacted
- User IDs converted to [UUID]

---

## 🎯 **Sentry Dashboard Configuration (5 minutes)**

### **Step 1: Access Sentry Dashboard**

1. Go to [sentry.io](https://sentry.io)
2. Select your Atlas project
3. Navigate to **Alerts** → **Create Alert Rule**

---

### **Step 2: Configure Alert Rules**

#### **Alert Rule 1: High Error Rate** 🚨

```
Name: High Error Rate - Atlas Production
Type: Issues
Conditions:
  - When: Event frequency is above 10 events
  - In: 5 minutes
  - For: Error level or higher
Actions:
  - Send email to: your-email@example.com
  - Send Slack notification (optional)
Environment: production
```

**Why:** Catches sudden spikes in errors (app breaking)

---

#### **Alert Rule 2: Slow Performance** ⚡

```
Name: Slow API Performance
Type: Metric Alerts
Conditions:
  - When: p95(transaction.duration) is above 2000ms
  - In: 10 minutes
  - For: Transaction name contains "api"
Actions:
  - Send email to: your-email@example.com
Environment: production
```

**Why:** Catches performance degradation before users complain

---

#### **Alert Rule 3: New Error Type** 🆕

```
Name: New Error Type Detected
Type: Issues
Conditions:
  - When: An issue is first seen
  - For: Error level
Actions:
  - Send email immediately
Environment: production, staging
```

**Why:** Get notified of new bugs immediately

---

#### **Alert Rule 4: Memory Usage** 💾

```
Name: High Memory Usage
Type: Metric Alerts
Conditions:
  - When: Custom metric "memory_usage_mb" is above 100
  - In: 5 minutes
Actions:
  - Send email to: your-email@example.com
Environment: production
```

**Why:** Prevent memory leaks from crashing the app

---

### **Step 3: Configure Integrations**

#### **Email Notifications** 📧

1. Go to **Settings** → **Notifications**
2. Enable: **Workflow notifications**
3. Enable: **Deploy notifications**
4. Set delivery: **Immediately** for critical, **Daily digest** for warnings

#### **Slack Integration** (Recommended) 💬

1. Go to **Settings** → **Integrations** → **Slack**
2. Click **Add Workspace**
3. Select channel: `#atlas-alerts`
4. Configure:
   - Error alerts → #atlas-alerts
   - Deploy notifications → #atlas-deploys
   - Weekly summary → #atlas-team

---

### **Step 4: Set Up Performance Thresholds**

1. Go to **Performance** → **Settings**
2. Configure thresholds:

```
Transaction thresholds:
  - /api/message: 1500ms (p95)
  - /api/chat: 2000ms (p95)
  - /api/image-analysis: 3000ms (p95)
  - /api/voice/transcribe: 2500ms (p95)
```

---

### **Step 5: Configure Issue Grouping**

1. Go to **Settings** → **Issue Grouping**
2. Enable:
   - **Stack trace grouping** ✅
   - **Message grouping** ✅
   - **Fingerprint override** ✅

3. Add custom fingerprinting rules:

```javascript
// Group by error type + file
{
  "fingerprint": ["{{ default }}", "{{ exception.type }}", "{{ exception.module }}"]
}
```

**Why:** Prevents alert spam from duplicate errors

---

## 🔥 **Recommended Alert Thresholds**

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate (5min) | 5 errors | 10 errors | Investigate |
| Error Rate (1hour) | 25 errors | 50 errors | Rollback? |
| API Response (p95) | 2000ms | 5000ms | Optimize |
| Memory Usage | 80MB | 100MB | Check leaks |
| New Errors | 1 | 5/hour | Fix ASAP |

---

## 📈 **Monitoring Dashboard Setup**

### **Custom Dashboard: Atlas Production Health**

1. Go to **Dashboards** → **Create Dashboard**
2. Name: **Atlas Production Health**
3. Add widgets:

#### **Widget 1: Error Rate**
```
Type: Line Chart
Query: count() by error.type
Time: Last 24 hours
```

#### **Widget 2: API Performance**
```
Type: Line Chart
Query: p95(transaction.duration) by transaction
Time: Last 4 hours
Threshold: 2000ms (warning line)
```

#### **Widget 3: User Impact**
```
Type: Big Number
Query: count_unique(user) where error.type is not null
Time: Last 1 hour
```

#### **Widget 4: Top Errors**
```
Type: Table
Query: count() by error.message
Limit: 10
Sort: Descending
```

---

## 🚨 **What Each Alert Means**

### **"HIGH ERROR RATE: 10 errors in last 5 minutes"**

**Severity:** CRITICAL  
**Likely Cause:**
- New deploy broke something
- External API down (Anthropic, Supabase)
- Database connection issue

**Action:**
1. Check latest deploy (last 10 mins)
2. Check Supabase status
3. Check backend logs
4. Consider rollback if >20 errors

---

### **"SLOW: operation took 2.5s"**

**Severity:** WARNING  
**Likely Cause:**
- Database query slow
- API rate limiting
- Network congestion

**Action:**
1. Check which operation (API call, DB query)
2. Review recent user load
3. Consider caching improvements

---

### **"HIGH MEMORY USAGE: 95MB"**

**Severity:** WARNING  
**Likely Cause:**
- Memory leak in long session
- Too many cached items
- Large file upload stuck in memory

**Action:**
1. Check if user has been active >2 hours
2. Review cache sizes
3. Monitor if it keeps growing

---

## 📱 **Mobile App Setup (iOS/Android)**

If you add mobile apps later, update:

```typescript
// src/services/sentryService.ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: Platform.OS === 'ios' ? 'ios-production' : 'android-production',
  // Mobile-specific config
  enableNative: true,
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
});
```

---

## ✅ **Verification Checklist**

After setup, verify:

- [ ] Email alerts arrive within 1 minute of error
- [ ] Slack notifications work (if configured)
- [ ] Dashboard shows real-time data
- [ ] Performance metrics update every minute
- [ ] PII is masked in error reports
- [ ] Test error appears in Sentry (`throw new Error('Test')`)

---

## 🎯 **Quick Test**

Run this in your browser console to verify Sentry is working:

```javascript
// Test error capture
throw new Error('Sentry Test Error - Ignore');

// Test performance tracking
import { performanceMonitor } from './services/performanceMonitor';
console.log(performanceMonitor.getSummary());

// Test error rate
import { errorRateTracker } from './services/sentryService';
console.log(errorRateTracker.getSummary());
```

---

## 📞 **Support & Resources**

- **Sentry Docs:** https://docs.sentry.io/
- **Alert Rules:** https://docs.sentry.io/product/alerts/
- **Performance:** https://docs.sentry.io/product/performance/
- **Best Practices:** https://docs.sentry.io/platforms/javascript/best-practices/

---

## 🎉 **You're Done!**

Atlas now has enterprise-grade monitoring:
✅ Error rate tracking  
✅ Performance monitoring  
✅ Memory usage alerts  
✅ Real-time notifications  

**Sleep better knowing you'll be alerted the moment something breaks!** 🛡️

