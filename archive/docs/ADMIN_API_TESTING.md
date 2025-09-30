# 📊 Atlas Admin API Testing Guide

## 🎯 **New Admin Endpoints Added**

### **1. 📊 GET /admin/snapshots**
**Purpose:** Get tier usage snapshots with filtering and pagination

**Query Parameters:**
- `email` - Filter by user email
- `tier` - Filter by tier (free, core, studio)  
- `from` - Filter from date (YYYY-MM-DD)
- `to` - Filter to date (YYYY-MM-DD)
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 50)

**Example Requests:**
```bash
# Get all snapshots
curl -s "https://atlas-production-2123.up.railway.app/api/admin/snapshots" | jq .

# Get snapshots for Jason's account
curl -s "https://atlas-production-2123.up.railway.app/api/admin/snapshots?email=jasonc.jpg@gmail.com" | jq .

# Get free tier snapshots from last week
curl -s "https://atlas-production-2123.up.railway.app/api/admin/snapshots?tier=free&from=2025-09-13" | jq .

# Get paginated results
curl -s "https://atlas-production-2123.up.railway.app/api/admin/snapshots?page=1&pageSize=10" | jq .
```

**Response Format:**
```json
{
  "success": true,
  "snapshots": [
    {
      "email": "jasonc.jpg@gmail.com",
      "tier": "free",
      "snapshot_date": "2025-09-20",
      "message_count": 16,
      "cost_accumulated": 0.80,
      "daily_limit": 15,
      "budget_ceiling": 20.00,
      "status": "BLOCKED - Daily Limit"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "pageSize": 50,
    "totalPages": 1
  },
  "filters": { "email": "jasonc.jpg@gmail.com" },
  "timestamp": "2025-09-20T11:10:00.000Z"
}
```

### **2. 📈 GET /admin/trends/:email**
**Purpose:** Get usage trends for specific user over time

**Parameters:**
- `email` - User email (URL parameter)
- `days` - Number of days to look back (query parameter, default: 30)

**Example Requests:**
```bash
# Get 30-day trend for Jason
curl -s "https://atlas-production-2123.up.railway.app/api/admin/trends/jasonc.jpg@gmail.com" | jq .

# Get 7-day trend
curl -s "https://atlas-production-2123.up.railway.app/api/admin/trends/jasonc.jpg@gmail.com?days=7" | jq .
```

### **3. 📋 GET /admin/summary**
**Purpose:** Get tier summary statistics for specific date

**Query Parameters:**
- `date` - Date in YYYY-MM-DD format (default: today)

**Example Requests:**
```bash
# Get today's summary
curl -s "https://atlas-production-2123.up.railway.app/api/admin/summary" | jq .

# Get specific date summary
curl -s "https://atlas-production-2123.up.railway.app/api/admin/summary?date=2025-09-20" | jq .
```

**Response Format:**
```json
{
  "success": true,
  "date": "2025-09-20",
  "summary": [
    {
      "tier": "free",
      "total_users": 1,
      "active_users": 0,
      "blocked_users": 1,
      "avg_messages": 16.00,
      "avg_cost": 0.8000,
      "total_cost": 0.80
    }
  ],
  "timestamp": "2025-09-20T11:10:00.000Z"
}
```

### **4. 🔄 POST /admin/snapshots/take**
**Purpose:** Manually trigger a tier usage snapshot

**Example Request:**
```bash
curl -X POST "https://atlas-production-2123.up.railway.app/api/admin/snapshots/take" | jq .
```

## 🧪 **Testing Sequence**

### **Step 1: Apply Database Migration**
Run `TIER_USAGE_SNAPSHOTS_MIGRATION.sql` in Supabase SQL Editor

### **Step 2: Take Initial Snapshot**
```bash
curl -X POST "https://atlas-production-2123.up.railway.app/api/admin/snapshots/take"
```

### **Step 3: Test All Endpoints**
```bash
# Test snapshots endpoint
curl -s "https://atlas-production-2123.up.railway.app/api/admin/snapshots" | jq .

# Test trends for Jason
curl -s "https://atlas-production-2123.up.railway.app/api/admin/trends/jasonc.jpg@gmail.com" | jq .

# Test summary
curl -s "https://atlas-production-2123.up.railway.app/api/admin/summary" | jq .
```

### **Step 4: Verify Data Flow**
- Check that snapshots contain Jason's test data (16 messages, $0.80, BLOCKED status)
- Verify trends show usage progression over time
- Confirm summary shows tier statistics correctly

## 🎯 **Expected Results**

✅ **Snapshots:** Show Jason's account with 16 messages, BLOCKED status  
✅ **Trends:** Show usage progression from 0 → 15 → 16 messages  
✅ **Summary:** Show 1 free tier user, 0 active, 1 blocked  
✅ **Manual Snapshot:** Creates new snapshot record successfully  

## 🚀 **Production Benefits**

### **Real-Time Monitoring**
- Track tier usage patterns across all users
- Identify upgrade conversion opportunities
- Monitor budget utilization trends

### **Business Intelligence**
- Daily/weekly/monthly usage reports
- Tier performance analytics
- Cost optimization insights

### **Operational Excellence**
- Automated daily snapshots via cron
- Historical trend analysis
- Proactive user engagement based on usage patterns

**This completes the enterprise-grade monitoring system for Atlas! 📊**
