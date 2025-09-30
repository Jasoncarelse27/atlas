# 🔍 Atlas Production Monitoring & Alerting Setup

## **📊 Monitoring Dashboard Checklist**

### **Railway Monitoring (Built-in)**
- [x] **Health Endpoint**: `/healthz` returns server status
- [x] **Logs**: Accessible via Railway dashboard
- [x] **Metrics**: CPU, memory, network usage
- [x] **Deployments**: Automatic deployment tracking

### **Supabase Monitoring**
- [x] **Database Health**: Connection status in logs
- [x] **Query Performance**: Slow query detection
- [x] **RLS Policies**: Security monitoring
- [x] **API Usage**: Request/response tracking

---

## **🚨 Critical Alerts Setup**

### **Backend Health Alerts**
```bash
# Monitor these endpoints every 5 minutes
curl -f https://atlas-production-2123.up.railway.app/healthz
curl -f https://atlas-production-2123.up.railway.app/admin/paddle-test
```

### **Key Metrics to Alert On**
1. **Server Down**: HTTP 5xx errors
2. **High Response Time**: > 5 seconds
3. **Memory Usage**: > 80% for 5+ minutes
4. **Database Errors**: Connection failures
5. **Payment Failures**: Paddle integration issues

### **Alert Thresholds**
- **Critical**: Server down, payment system down
- **Warning**: High memory, slow responses
- **Info**: Deployment success, new user signups

---

## **📈 Key Metrics Dashboard**

### **Business Metrics**
```sql
-- Daily signups
SELECT DATE(created_at), COUNT(*) 
FROM auth.users 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- Tier distribution
SELECT tier, COUNT(*) 
FROM user_profiles 
GROUP BY tier;

-- Daily message usage
SELECT DATE(created_at), tier, COUNT(*) 
FROM daily_usage 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), tier;
```

### **Technical Metrics**
```sql
-- Feature attempt logs
SELECT feature, allowed, COUNT(*) 
FROM feature_attempts 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY feature, allowed;

-- Error rates by endpoint
SELECT endpoint, status_code, COUNT(*) 
FROM request_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY endpoint, status_code;
```

---

## **🔧 Monitoring Scripts**

### **Health Check Script** (`monitor-health.sh`)
```bash
#!/bin/bash
BASE_URL="https://atlas-production-2123.up.railway.app"

# Check health endpoint
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/healthz")
if [ "$HEALTH" != "200" ]; then
    echo "🚨 CRITICAL: Health endpoint returned $HEALTH"
    # Send alert (email, Slack, etc.)
fi

# Check Paddle integration
PADDLE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/paddle-test")
if [ "$PADDLE" != "200" ]; then
    echo "⚠️ WARNING: Paddle endpoint returned $PADDLE"
fi

echo "✅ Health check completed at $(date)"
```

### **Daily Metrics Report** (`daily-metrics.sh`)
```bash
#!/bin/bash
echo "📊 Atlas Daily Metrics Report - $(date)"
echo "=================================="

# User signups today
echo "👥 New users today:"
curl -s "$BASE_URL/admin/metrics/users-today" | jq '.count'

# Messages sent today
echo "💬 Messages today:"
curl -s "$BASE_URL/admin/metrics/messages-today" | jq '.count'

# Tier distribution
echo "🎯 Tier distribution:"
curl -s "$BASE_URL/admin/metrics/tier-distribution" | jq '.'

# System health
echo "🔍 System health:"
curl -s "$BASE_URL/healthz" | jq '.status'
```

---

## **📱 Alert Channels**

### **Email Alerts** (Primary)
- **Critical**: Immediate email to jason@example.com
- **Warning**: Daily digest at 9 AM
- **Info**: Weekly summary on Mondays

### **Slack Integration** (Optional)
- **Channel**: #atlas-alerts
- **Critical**: @channel notifications
- **Warning**: Regular notifications
- **Info**: Daily summary

### **SMS Alerts** (Critical Only)
- **Server Down**: Immediate SMS
- **Payment System Down**: Immediate SMS
- **Database Outage**: Immediate SMS

---

## **🛠️ Railway-Specific Monitoring**

### **Railway CLI Commands**
```bash
# Check service status
railway status

# View logs
railway logs

# Check metrics
railway metrics

# Monitor deployments
railway deployments
```

### **Railway Dashboard Checks**
- [ ] **Service Health**: Green status
- [ ] **Resource Usage**: CPU < 70%, Memory < 80%
- [ ] **Network**: Low latency, no errors
- [ ] **Deployments**: Recent successful deployments

---

## **🔍 Error Tracking**

### **Frontend Error Tracking**
```javascript
// Add to main.tsx
window.addEventListener('error', (event) => {
  // Log to Supabase
  supabase.from('error_logs').insert({
    type: 'frontend_error',
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack,
    timestamp: new Date().toISOString()
  });
});
```

### **Backend Error Tracking**
```javascript
// Already implemented in backend/server.mjs
// Logs errors to Supabase logs table
```

---

## **📊 Performance Monitoring**

### **Response Time Targets**
- **Health Check**: < 200ms
- **Message Endpoint**: < 3 seconds
- **Auth Endpoint**: < 1 second
- **Paddle Test**: < 500ms

### **Throughput Targets**
- **Concurrent Users**: Support 100+ simultaneous
- **Messages/Minute**: Handle 1000+ messages
- **Database Queries**: < 100ms average

---

## **🚀 Launch Day Monitoring**

### **Pre-Launch (1 hour before)**
- [ ] All monitoring scripts tested
- [ ] Alert channels verified
- [ ] Dashboard access confirmed
- [ ] On-call rotation ready

### **Launch (Go Live)**
- [ ] Monitor signup rate
- [ ] Watch for error spikes
- [ ] Check payment processing
- [ ] Track user engagement

### **Post-Launch (First 24 hours)**
- [ ] Daily metrics report
- [ ] User feedback review
- [ ] Performance analysis
- [ ] Error log review

---

## **📋 Monitoring Checklist**

### **Daily (5 minutes)**
- [ ] Check Railway dashboard
- [ ] Review error logs
- [ ] Verify health endpoints
- [ ] Check user signups

### **Weekly (30 minutes)**
- [ ] Performance trend analysis
- [ ] User engagement metrics
- [ ] Feature usage statistics
- [ ] Plan monitoring improvements

### **Monthly (1 hour)**
- [ ] Full system health review
- [ ] Monitoring tool evaluation
- [ ] Alert threshold adjustment
- [ ] Capacity planning

---

## **🎯 Success Metrics**

**Monitoring is working when:**
- ✅ Alerts fire within 5 minutes of issues
- ✅ No false positives (crying wolf)
- ✅ All critical systems monitored
- ✅ Performance trends visible
- ✅ Business metrics tracked

**Atlas V1 will launch with enterprise-grade monitoring! 🔍**
