# Atlas CI/CD Deployment Guide

## 🚀 Overview

Atlas uses a unified CI/CD pipeline that handles:
- Automated testing and linting
- Security scanning
- Health checks (including Redis)
- Staging deployments
- Production deployments (manual trigger)
- Automatic rollback on failure
- Sentry release tracking

## 📋 Prerequisites

1. **GitHub Secrets** - Run the setup script:
   ```bash
   ./scripts/setup-github-secrets.sh
   ```

2. **Required Services**:
   - Supabase project (with service role key)
   - Redis instance (for caching)
   - FastSpring account (for payments)
   - Sentry account (optional, for monitoring)

## 🔄 Pipeline Stages

### 1. Build & Test (Every Push/PR)
- Installs dependencies
- Runs linting and type checking
- Executes unit tests with coverage
- Builds frontend for production
- Uploads artifacts

### 2. Security & Health Checks
- Runs npm audit for vulnerabilities
- Starts backend and verifies health
- Tests Redis connectivity
- Scans for hardcoded secrets

### 3. Database Migration Check (Main Branch Only)
- Lists pending migrations
- Tracks migration history
- Prevents deployment if migrations are missing

### 4. Staging Deployment (Auto on Main)
- Deploys to staging environment
- Verifies frontend and backend health
- Creates Sentry release for staging

### 5. Production Deployment (Manual)
- Requires manual trigger via GitHub Actions
- Performs additional health checks
- Runs smoke tests
- Creates Sentry release with version tracking

### 6. Automatic Rollback
- Triggers if production deployment fails
- Reverts to previous stable version
- Marks failed release in Sentry

## 🛠️ Deployment Commands

### Deploy to Staging (Automatic)
```bash
# Push to main branch
git push origin main
```

### Deploy to Production (Manual)
1. Go to GitHub Actions tab
2. Select "Atlas Unified CI/CD Pipeline"
3. Click "Run workflow"
4. Select branch: `main`
5. Choose deployment environment: `production`
6. Click "Run workflow"

### Monitor Deployment
```bash
# Watch deployment progress
gh run watch

# View deployment logs
gh run view --log
```

## 🔐 Environment Configuration

### Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | `eyJhbGc...` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `REDIS_URL` | Redis connection string | `redis://user:pass@host:6379` |
| `STAGING_URL` | Staging environment URL | `https://staging.atlas.com` |
| `PRODUCTION_URL` | Production URL | `https://atlas.com` |
| `FASTSPRING_API_USERNAME` | FastSpring API username | `api_user` |
| `FASTSPRING_API_PASSWORD` | FastSpring API password | `api_pass` |
| `FASTSPRING_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |

### Optional Secrets

| Secret | Description | Purpose |
|--------|-------------|---------|
| `SENTRY_DSN` | Sentry project DSN | Error tracking |
| `SENTRY_AUTH_TOKEN` | Sentry auth token | Release management |
| `CODECOV_TOKEN` | Codecov token | Code coverage reports |

## 🩺 Health Checks

The pipeline performs comprehensive health checks:

1. **Backend Health** (`/healthz`)
   - Supabase connectivity
   - Redis connectivity
   - Memory usage
   - Response time

2. **Frontend Health**
   - Page load test
   - API connectivity
   - Asset loading

3. **Redis Health**
   - Connection test
   - Read/write operations
   - Cache invalidation

## 🚨 Troubleshooting

### Build Failures
```bash
# Check for TypeScript errors
npm run typecheck

# Fix linting issues
npm run lint:fix
```

### Test Failures
```bash
# Run tests locally
npm run test

# Run specific test file
npm test auth.critical.test.ts
```

### Deployment Failures
```bash
# Check deployment logs
gh run view --log

# Verify environment variables
gh secret list

# Test health endpoints locally
curl http://localhost:8000/healthz
```

### Redis Connection Issues
```bash
# Test Redis connection
node scripts/test-redis.js

# Check Redis URL format
# Should be: redis://[username:password@]host:port[/database]
```

## 📊 Monitoring

### Deployment Status
- GitHub Actions: Check workflow runs
- Sentry: Monitor releases and errors
- Application logs: Check for runtime errors

### Performance Metrics
- Backend response times
- Redis cache hit rates
- Database query performance

## 🔄 Rollback Procedure

### Automatic Rollback
If production deployment fails, the pipeline automatically:
1. Detects failure
2. Initiates rollback
3. Marks release as failed in Sentry

### Manual Rollback
```bash
# Using Railway
railway rollback

# Using GitHub
# 1. Go to Actions tab
# 2. Run "Manual Rollback" workflow
# 3. Select version to rollback to
```

## 📈 Best Practices

1. **Always test locally first**
   ```bash
   npm run build
   npm run test
   npm run lint
   ```

2. **Use staging for validation**
   - Test new features in staging
   - Verify payment flows
   - Check tier enforcement

3. **Monitor after deployment**
   - Watch Sentry for new errors
   - Check application metrics
   - Verify user experience

4. **Document changes**
   - Update CHANGELOG.md
   - Tag releases properly
   - Include migration notes

## 🎯 Production Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] No security vulnerabilities
- [ ] Database migrations applied
- [ ] FastSpring webhooks tested
- [ ] Redis cache warmed up
- [ ] Sentry configured
- [ ] Environment variables set
- [ ] Staging deployment successful
- [ ] Smoke tests passed
- [ ] Rollback plan ready

## 🆘 Emergency Contacts

- **Infrastructure Issues**: Check Railway/Vercel status
- **Database Issues**: Supabase dashboard
- **Payment Issues**: FastSpring support
- **Error Tracking**: Sentry dashboard

---

Remember: **Always deploy to staging first!** Production deployments should only happen after thorough testing in staging environment.
