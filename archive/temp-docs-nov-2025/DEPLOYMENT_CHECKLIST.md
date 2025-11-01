# 🚀 Atlas Deployment Checklist

Comprehensive pre-launch checklist for Atlas production deployment.

---

## 📋 **Pre-Deployment Verification**

### **1. Code Quality** ✅

- [ ] **All tests passing (100%)**
  ```bash
  npm test -- --run
  # Expected: 177/177 tests passing
  ```

- [ ] **No TypeScript errors**
  ```bash
  npm run typecheck
  # Expected: No errors
  ```

- [ ] **No linter errors/warnings**
  ```bash
  npm run lint
  # Expected: 0 warnings, 0 errors
  ```

- [ ] **Production build successful**
  ```bash
  npm run build
  # Expected: dist/ folder created, no errors
  ```

- [ ] **Bundle size acceptable**
  - Main bundle: < 700KB gzipped
  - ChatPage: < 450KB gzipped
  - RitualInsightsDashboard: < 110KB gzipped

### **2. Environment Configuration** 🔐

#### **Production Environment Variables**

- [ ] **Supabase**
  - `VITE_SUPABASE_URL` - Production Supabase URL
  - `VITE_SUPABASE_ANON_KEY` - Production anon key
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)

- [ ] **Backend API**
  - `VITE_BACKEND_URL` - Production API URL (Railway)
  - `PORT` - Set to Railway's `$PORT` variable
  - `NODE_ENV=production`

- [ ] **FastSpring**
  - `VITE_FASTSPRING_STOREFRONT_ID` - Production storefront ID
  - `FASTSPRING_API_KEY` - Production API key
  - `FASTSPRING_API_SECRET` - Production API secret

- [ ] **MailerLite**
  - `MAILERLITE_API_KEY` - Production API key
  - Email templates created and tested

- [ ] **AI Models**
  - `CLAUDE_API_KEY` - Anthropic API key
  - `GROQ_API_KEY` - Groq API key (optional)
  - Billing alerts configured for API providers

#### **Security Variables**

- [ ] **Secret Rotation**
  - All JWT secrets rotated for production
  - Service role key limited to backend only
  - No secrets in client-side code

- [ ] **CORS Configuration**
  - Allowed origins limited to production domains
  - No `localhost` or `*` wildcards in production

### **3. Database Setup** 🗄️

- [ ] **Supabase Production Project**
  - Production project created
  - Row Level Security (RLS) policies applied
  - Database migrations applied:
    - `20250115_atlas_v1_schema.sql`
    - `20250916_phase5_triggers.sql`

- [ ] **Database Verification**
  ```sql
  -- Verify tables exist
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public';
  
  -- Expected tables:
  -- messages, conversations, profiles, rituals, ritual_logs, 
  -- ritual_steps, feature_attempts, feature_flags, 
  -- email_failures, daily_usage, budget_tracking
  ```

- [ ] **RLS Policies Active**
  ```sql
  -- Check RLS is enabled
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public';
  
  -- All tables should have rowsecurity = true
  ```

- [ ] **Database Cleanup Jobs**
  - pg_cron installed (or manual cleanup scheduled)
  - Daily cleanup job scheduled (00:10 UTC)
  - Test cleanup functions work:
    ```sql
    SELECT rotate_daily_usage();
    SELECT compact_budget_tracking();
    SELECT cleanup_old_cache_entries();
    ```

### **4. Feature Verification** 🎯

#### **Core Features**

- [ ] **Authentication**
  - Sign up flow works
  - Login flow works
  - Password reset works
  - Session persistence works
  - Logout works

- [ ] **Chat Interface**
  - Message sending works
  - Claude API integration works
  - Message history loads correctly
  - Real-time updates work

- [ ] **Tier System**
  - Free tier limits enforced (15 messages/month)
  - Upgrade prompts appear correctly
  - Tier-gated features work:
    - Audio (Core+)
    - Image analysis (Core+)
    - Advanced models (Studio)

- [ ] **Rituals**
  - Ritual library loads
  - Start ritual flow works
  - Complete ritual flow works
  - Custom ritual creation works
  - Ritual analytics display correctly

#### **Mobile Optimization**

- [ ] **Responsive Design**
  - Test on mobile viewport (375x667)
  - Test on tablet viewport (768x1024)
  - Test on desktop (1920x1080)

- [ ] **Mobile Gestures**
  - Swipe gestures work
  - Pull-to-refresh works
  - Haptic feedback works (if supported)
  - Touch targets ≥ 48px (iOS) / 120px (optimal)

- [ ] **PWA Features**
  - Service worker registered
  - Offline mode works
  - Install prompt appears
  - App manifest valid

#### **Subscription Flow**

- [ ] **FastSpring Integration**
  - Checkout URL generation works
  - Redirect to FastSpring works
  - Webhook handler works
  - Subscription status updates correctly
  - Cancel/reactivate flows work

- [ ] **Tier Upgrades**
  - Free → Core upgrade works
  - Core → Studio upgrade works
  - Downgrade flow works
  - Trial period handled correctly

### **5. Performance** ⚡

- [ ] **Load Times**
  - First Contentful Paint (FCP) < 1.5s
  - Time to Interactive (TTI) < 3.5s
  - Largest Contentful Paint (LCP) < 2.5s

- [ ] **Optimization Checks**
  - Lazy loading implemented for heavy components
  - Images optimized (WebP format)
  - Code splitting applied
  - React.memo used for expensive components

- [ ] **Caching Strategy**
  - Static assets cached (1 year)
  - API responses cached appropriately
  - Service worker caching configured

### **6. Security** 🔒

- [ ] **Secret Scanning**
  - No hardcoded secrets in code
  - Pre-commit hooks active
  - Secret scan CI/CD workflow passing

- [ ] **API Security**
  - Rate limiting enabled (100 req/15min global)
  - Message endpoint rate limited (20 req/min)
  - JWT validation on all protected endpoints
  - CORS properly configured

- [ ] **Frontend Security**
  - No localStorage used for sensitive data
  - XSS protection enabled (Helmet)
  - CSP headers configured
  - HTTPS enforced

- [ ] **Database Security**
  - RLS policies tested
  - Service role key secured (backend only)
  - User data isolation verified

### **7. Monitoring & Logging** 📊

- [ ] **Error Tracking**
  - Sentry configured (or equivalent)
  - Error boundaries in place
  - Unhandled errors logged

- [ ] **Health Checks**
  - `/healthz` endpoint works
  - Railway health checks configured
  - Database connectivity monitored

- [ ] **Usage Analytics**
  - Feature usage tracked
  - Tier enforcement logged
  - API costs monitored

- [ ] **Email Monitoring**
  - Email failures logged to `email_failures` table
  - `npm run check:failures` command works
  - MailerLite delivery rates monitored

### **8. Deployment Platform** 🚂

#### **Railway Configuration**

- [ ] **Backend Deployment**
  - Service connected to GitHub
  - Environment variables set
  - Health checks configured
  - Auto-deploy enabled on main branch
  - Resource limits appropriate:
    - Memory: 512MB minimum
    - CPU: 1 vCPU minimum

- [ ] **Post-Deploy Hooks**
  - Test user creation script runs
  - Database migrations applied

#### **Vercel Configuration (Frontend)**

- [ ] **Frontend Deployment**
  - Project connected to GitHub
  - Environment variables set
  - Auto-deploy enabled on main branch
  - Build command: `npm run build`
  - Output directory: `dist`

- [ ] **Domain Configuration**
  - Production domain configured
  - SSL certificate active
  - DNS records correct

### **9. Backup & Rollback** 💾

- [ ] **Backup Strategy**
  - Supabase daily backups enabled
  - Point-in-time recovery configured
  - Database export tested

- [ ] **Rollback Plan**
  - Previous deployment tagged in git
  - Rollback procedure documented
  - Database migration rollback scripts ready

### **10. Testing in Production** 🧪

#### **Smoke Tests**

- [ ] **Homepage loads**
- [ ] **Login works**
- [ ] **Send message works**
- [ ] **Ritual flow works**
- [ ] **Upgrade prompt works**

#### **Cross-Browser Testing**

- [ ] **Chrome** (latest)
- [ ] **Firefox** (latest)
- [ ] **Safari** (latest)
- [ ] **Mobile Safari** (iOS 15+)
- [ ] **Mobile Chrome** (Android 10+)

#### **User Acceptance Testing**

- [ ] **Free tier user journey**
  - Sign up → onboard → send messages → hit limit → upgrade prompt
- [ ] **Core tier user journey**
  - Upgrade → unlimited messages → voice/image features → rituals
- [ ] **Studio tier user journey**
  - Upgrade → advanced models → full feature access

---

## 🚨 **Launch Day Checklist**

### **Pre-Launch (T-24 hours)**

- [ ] Final production build deployed
- [ ] All smoke tests passing
- [ ] Error tracking active
- [ ] Health checks green
- [ ] Team notified of launch

### **Launch (T-0)**

- [ ] Switch DNS to production (if needed)
- [ ] Verify site loads at production URL
- [ ] Monitor error rates in Sentry
- [ ] Monitor API response times
- [ ] Monitor database performance

### **Post-Launch (T+1 hour)**

- [ ] Check user registrations working
- [ ] Check first messages sent successfully
- [ ] Check upgrade flow working
- [ ] Check FastSpring webhooks firing
- [ ] Check email delivery working

### **Post-Launch (T+24 hours)**

- [ ] Review error logs
- [ ] Review performance metrics
- [ ] Review user feedback
- [ ] Check API costs vs. projections
- [ ] Check database size vs. projections

---

## 📞 **Support Contacts**

- **Supabase**: support@supabase.io
- **Railway**: support@railway.app
- **FastSpring**: support@fastspring.com
- **Anthropic (Claude)**: support@anthropic.com
- **MailerLite**: support@mailerlite.com

---

## 🎉 **Ready to Launch?**

If all checkboxes are ✅, you're ready to deploy Atlas to production!

**Final Command:**
```bash
# Run full pre-deploy check
npm run lint && npm run typecheck && npm test -- --run && npm run build

# If all pass:
git tag -a v1.0.0 -m "Atlas V1 Production Release"
git push origin v1.0.0
git push origin main
```

🚀 **Happy Launching!**
