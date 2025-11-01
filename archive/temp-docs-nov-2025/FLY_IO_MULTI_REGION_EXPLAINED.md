# 🌍 Fly.io Multi-Region Deployment Explained

**Date:** October 31, 2025  
**Status:** ✅ Multi-Region Setup Complete

---

## 🎯 **What Happens in Fly.io When You Deploy Multi-Region**

### **Step-by-Step Process:**

#### **1. Initial Deployment (US Region)**
```bash
flyctl deploy --app atlas-voice-v2 --region iad
```

**What Happens:**
- Fly.io creates a **machine** (VM) in Washington DC (`iad`)
- Your Docker container starts on that machine
- Machine gets IP address and joins Fly.io's network
- DNS record created: `atlas-voice-v2.fly.dev` → points to US machine
- Health checks start running every 30 seconds

**Result:** 
- ✅ US users connect directly to Washington DC
- ✅ Latency: ~10-50ms for US users

---

#### **2. Clone Machine to EU Region**
```bash
flyctl machine clone <machine-id> --region fra
```

**What Happens:**
- Fly.io **copies** your machine configuration to Frankfurt (`fra`)
- Creates new VM in Frankfurt with **same code**
- Deploys **same Docker image** to EU machine
- Both machines run **independently** (separate VMs)
- **Same secrets** are available to both (Fly.io syncs them)

**Result:**
- ✅ EU users connect directly to Frankfurt
- ✅ Latency: ~10-50ms for EU users
- ✅ US users still connect to Washington DC

---

#### **3. How Fly.io Routes Users Automatically**

**The Magic: Anycast DNS + Geographic Routing**

```
User in New York → DNS lookup → atlas-voice-v2.fly.dev
                                    ↓
                           Fly.io DNS Server
                                    ↓
                    Checks user's geographic location
                                    ↓
                    Routes to nearest machine:
                    - US users → iad (Washington DC)
                    - EU users → fra (Frankfurt)
```

**How It Works:**
1. **Anycast DNS**: Fly.io uses Anycast DNS (same IP address in multiple locations)
2. **Geographic Routing**: DNS server routes based on user's location
3. **Low Latency**: Users connect to nearest machine automatically
4. **No Code Changes**: Your app uses same URL (`wss://atlas-voice-v2.fly.dev`)

---

## 🔍 **What You See in Fly.io Dashboard**

### **Machines View:**
```
Machines:
├── Machine 1 (iad) - Washington DC
│   ├── Status: started
│   ├── Region: iad
│   ├── IP: 198.51.100.1
│   └── Health: healthy
│
└── Machine 2 (fra) - Frankfurt
    ├── Status: started
    ├── Region: fra
    ├── IP: 203.0.113.1
    └── Health: healthy
```

### **Traffic Distribution:**
- **US Users (60%)** → Machine 1 (iad)
- **EU Users (40%)** → Machine 2 (fra)

---

## 💰 **Cost Breakdown**

### **Single Region (US Only):**
- 1 machine × $5.20/month = **$5.20/month**

### **Multi-Region (US + EU):**
- 1 machine (iad) × $5.20/month = $5.20
- 1 machine (fra) × $5.20/month = $5.20
- **Total: $10.40/month**

**Bandwidth:** Included (no extra cost)

---

## 🚀 **What Happens When a User Connects**

### **Example: User in London Connects**

```
1. User opens Atlas app
   ↓
2. App tries to connect: wss://atlas-voice-v2.fly.dev
   ↓
3. DNS lookup (from London)
   ↓
4. Fly.io DNS server detects: "User is in Europe"
   ↓
5. Routes to: fra (Frankfurt) machine
   ↓
6. WebSocket connection established
   ↓
7. Latency: ~15ms (London → Frankfurt)
```

### **Example: User in New York Connects**

```
1. User opens Atlas app
   ↓
2. App tries to connect: wss://atlas-voice-v2.fly.dev
   ↓
3. DNS lookup (from New York)
   ↓
4. Fly.io DNS server detects: "User is in US"
   ↓
5. Routes to: iad (Washington DC) machine
   ↓
6. WebSocket connection established
   ↓
7. Latency: ~12ms (New York → Washington DC)
```

---

## 🛡️ **Failover & High Availability**

### **What Happens if One Machine Fails?**

**Scenario: Frankfurt machine crashes**

```
1. Health check fails (after 30 seconds)
   ↓
2. Fly.io automatically removes failed machine from DNS
   ↓
3. All traffic routes to Washington DC (iad)
   ↓
4. EU users connect to US (higher latency, but still works)
   ↓
5. You get alerted via Fly.io dashboard
   ↓
6. Fix machine or deploy new one
```

**Result:** ✅ **Zero downtime** - app stays online

---

## 📊 **Monitoring Multi-Region**

### **View All Machines:**
```bash
flyctl machines list --app atlas-voice-v2
```

**Output:**
```
ID              NAME    STATE   REGION  CREATED
abc123def456    app     started iad     2025-10-31T15:00:00Z
xyz789ghi012    app     started fra     2025-10-31T15:05:00Z
```

### **View Logs by Region:**
```bash
# US region logs
flyctl logs --app atlas-voice-v2 --region iad

# EU region logs
flyctl logs --app atlas-voice-v2 --region fra

# All logs
flyctl logs --app atlas-voice-v2
```

### **View Metrics:**
```bash
flyctl dashboard --app atlas-voice-v2
```

**Dashboard Shows:**
- Traffic per region
- Latency per region
- Error rates per region
- Cost breakdown

---

## 🔧 **Technical Details**

### **What Gets Shared:**
- ✅ **Secrets**: Same environment variables on both machines
- ✅ **Code**: Same Docker image deployed to both
- ✅ **Configuration**: Same `fly.toml` settings

### **What's Separate:**
- ❌ **Machines**: Different VMs (separate hardware)
- ❌ **Database Connections**: Each machine connects to Supabase independently
- ❌ **Session State**: In-memory sessions are per-machine (not shared)
- ❌ **WebSocket Connections**: Users connect to one machine only

### **Important for Voice V2:**
- ✅ **Sessions are per-machine**: If user disconnects/reconnects, might connect to different machine
- ✅ **Database is shared**: Supabase is external, so all machines write to same DB
- ✅ **No session sync needed**: We don't store sessions in memory (just use DB)

---

## 🎯 **Best Practices**

### **1. Health Checks**
- Each machine runs health checks independently
- Unhealthy machines are removed from routing automatically

### **2. Deployment**
- Deploy to primary region first (iad)
- Clone to secondary region (fra)
- Both regions stay in sync automatically

### **3. Scaling**
- Scale each region independently:
  ```bash
  flyctl scale count 2 --region iad  # 2 machines in US
  flyctl scale count 1 --region fra  # 1 machine in EU
  ```

### **4. Monitoring**
- Monitor both regions separately
- Set up alerts for each region
- Track latency per region

---

## 📝 **Deployment Commands**

### **First Time Setup:**
```bash
cd api/voice-v2
./deploy-multi-region.sh
```

### **Update Both Regions:**
```bash
# Deploy to US (primary)
flyctl deploy --app atlas-voice-v2 --region iad

# Deploy to EU (secondary)
flyctl deploy --app atlas-voice-v2 --region fra
```

### **Or Use Single Command:**
```bash
# Deploy to all regions
flyctl deploy --app atlas-voice-v2
```

---

## ✅ **Summary**

**What Fly.io Does:**
1. ✅ Creates machines in multiple regions
2. ✅ Routes users to nearest machine automatically
3. ✅ Shares secrets across all machines
4. ✅ Handles failover automatically
5. Keeps both regions in sync

**What You Get:**
- ✅ Low latency globally (< 50ms)
- ✅ High availability (failover protection)
- ✅ GDPR compliance (EU data stays in EU)
- ✅ Zero code changes (same URL everywhere)

**Cost:**
- $10.40/month for global coverage

---

**Status:** ✅ Ready to deploy!

