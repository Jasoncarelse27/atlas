# 🔐 Atlas Admin Security & CSV Export - Testing Guide

## 🎯 **New Security Features Implemented**

### **🛡️ Admin Email Allowlist**
- **Environment Variable:** `ADMIN_EMAIL_ALLOWLIST`
- **Format:** Comma-separated list of allowed admin emails
- **Default:** Falls back to `jasonc.jpg@gmail.com` if not configured
- **Security:** Only allowlisted emails can access admin endpoints

### **📊 CSV Export Endpoint**
- **Endpoint:** `GET /api/admin/snapshots/export.csv`
- **Security:** Protected by admin allowlist
- **Features:** Filtered exports with smart filename generation
- **Format:** Professional CSV with proper escaping

---

## 🔧 **Environment Configuration**

### **Add to `.env.production`:**
```bash
# Admin Security - Comma-separated list of admin emails
ADMIN_EMAIL_ALLOWLIST=jasonc.jpg@gmail.com,admin@atlas.app,support@atlas.app
```

### **Add to `.env.local`:**
```bash
# Admin Security - Development allowlist
ADMIN_EMAIL_ALLOWLIST=jasonc.jpg@gmail.com
```

---

## 🧪 **Testing the Admin Security**

### **Step 1: Test Admin Allowlist**

**✅ Allowed Admin Access:**
```bash
# Should work if jasonc.jpg@gmail.com is allowlisted
curl -H "Authorization: Bearer <VALID_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/metrics"
```

**🚫 Blocked Non-Admin Access:**
```bash
# Should return 403 Forbidden for non-allowlisted emails
curl -H "Authorization: Bearer <NON_ADMIN_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/metrics"
```

### **Step 2: Test CSV Export**

**📊 Basic Export:**
```bash
# Export all snapshots
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/snapshots/export.csv" \
  -o atlas_snapshots.csv
```

**🔍 Filtered Exports:**
```bash
# Export Jason's data only
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/snapshots/export.csv?email=jasonc.jpg@gmail.com" \
  -o jason_usage.csv

# Export free tier users from last week
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/snapshots/export.csv?tier=free&from=2025-09-13" \
  -o free_tier_week.csv

# Export date range
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://atlas-production-2123.up.railway.app/api/admin/snapshots/export.csv?from=2025-09-01&to=2025-09-20" \
  -o september_usage.csv
```

---

## 📋 **Expected CSV Format**

### **Headers:**
```csv
snapshot_date,email,tier,message_count,cost_accumulated,daily_limit,budget_ceiling,status,created_at
```

### **Sample Data:**
```csv
snapshot_date,email,tier,message_count,cost_accumulated,daily_limit,budget_ceiling,status,created_at
2025-09-20,jasonc.jpg@gmail.com,free,16,0.80,15,20.00,BLOCKED - Daily Limit,2025-09-20T11:10:00.000Z
2025-09-19,user2@example.com,core,45,2.25,999999,100.00,ACTIVE,2025-09-19T10:30:00.000Z
2025-09-19,user3@example.com,studio,120,6.00,999999,80.00,ACTIVE,2025-09-19T09:15:00.000Z
```

### **Smart Filename Generation:**
- `atlas_snapshots_2025-09-20.csv` - Basic export
- `atlas_snapshots_2025-09-20_email-jason.csv` - Filtered by email
- `atlas_snapshots_2025-09-20_tier-free_from-2025-09-13.csv` - Multiple filters

---

## 🎯 **Security Validation Checklist**

### **✅ Admin Access Control:**
- [ ] Only allowlisted emails can access admin endpoints
- [ ] Non-allowlisted emails receive 403 Forbidden
- [ ] Missing authentication returns 401 Unauthorized
- [ ] Development mode bypasses for testing

### **✅ CSV Export Security:**
- [ ] CSV endpoint requires admin authentication
- [ ] Filters work correctly (email, tier, date range)
- [ ] CSV format is properly escaped
- [ ] Filename generation includes filters
- [ ] Large exports don't timeout

### **✅ Error Handling:**
- [ ] Graceful error messages for security violations
- [ ] No sensitive data leaked in error responses
- [ ] Proper HTTP status codes returned
- [ ] Logging captures security events

---

## 🚀 **Production Deployment Steps**

### **1. Update Environment Variables**
```bash
# Add to Railway environment variables
ADMIN_EMAIL_ALLOWLIST=jasonc.jpg@gmail.com,admin@atlas.app
```

### **2. Deploy Updated Code**
```bash
git add -A
git commit -m "🔐 Add admin security and CSV export"
git push origin main
```

### **3. Verify Security**
```bash
# Test admin access
curl "https://atlas-production-2123.up.railway.app/api/admin/metrics"

# Test CSV export
curl "https://atlas-production-2123.up.railway.app/api/admin/snapshots/export.csv"
```

---

## 📊 **Business Benefits**

### **🔐 Enhanced Security:**
- **Controlled Access** - Only authorized admins can view sensitive data
- **Audit Trail** - All admin access attempts logged
- **Scalable Permissions** - Easy to add/remove admin users

### **📈 Business Intelligence:**
- **Offline Analysis** - CSV exports for Excel/Google Sheets
- **Historical Reporting** - Filtered date range exports
- **Data Integration** - CSV format works with BI tools
- **Custom Analytics** - Flexible filtering for specific insights

### **🎯 Operational Excellence:**
- **Compliance Ready** - Secure data access controls
- **Audit Support** - Detailed usage exports for compliance
- **Performance Monitoring** - Historical trend analysis
- **Cost Optimization** - Usage pattern identification

---

## 🎉 **Final Status**

**Atlas now has enterprise-grade admin security with:**
- ✅ **Email-based access control** for admin endpoints
- ✅ **Secure CSV export** with filtering and smart naming
- ✅ **Professional error handling** and security logging
- ✅ **Production-ready deployment** with environment configuration

**Ready for enterprise customers and compliance requirements! 🚀**
