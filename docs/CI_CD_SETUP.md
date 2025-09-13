# Atlas AI CI/CD Pipeline Setup

## 🚀 Overview

Atlas AI uses a comprehensive CI/CD pipeline that implements the **Gold Standard Launch Playbook** principles:

- **Core Validation = BLOCKING** (TypeScript, ESLint, Tests, Build)
- **E2E Validation = NON-BLOCKING** (Playwright UX/Browser)
- **Monitoring = ALWAYS ON**

## 📋 Workflows

### 1. Main CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:** Push to `main`/`develop`, Pull Requests to `main`

**Jobs:**
- **Core Validation (BLOCKING)**: Runs `staging-validation.sh`
- **E2E Validation (NON-BLOCKING)**: Runs `playwright-validation.sh`

**Features:**
- ✅ Blocks deployments if core validation fails
- ✅ Continues with E2E even if core validation fails
- ✅ Uploads test artifacts for review

### 2. Nightly E2E Testing (`.github/workflows/nightly-e2e.yml`)

**Triggers:** Daily at 2 AM UTC, Manual dispatch

**Features:**
- ✅ Runs comprehensive E2E tests nightly
- ✅ Creates GitHub issues on failure
- ✅ Sends email alerts to admin@otiumcreations.com
- ✅ Auto-closes issues when tests pass

### 3. Production Deployment (`.github/workflows/deploy.yml`)

**Triggers:** Git tags (v*)

**Features:**
- ✅ Runs Gold Standard validation before deployment
- ✅ Deploys to Vercel (frontend) and Railway (backend)
- ✅ Post-deployment health checks
- ✅ Deployment summary reporting

### 4. Manual E2E Testing (`.github/workflows/manual-e2e.yml`)

**Triggers:** Manual dispatch

**Features:**
- ✅ Selectable test suites (all, cross-browser, mobile, chat)
- ✅ Environment selection (staging, production)
- ✅ Detailed test reporting
- ✅ PR comment integration

## 🔧 Required Secrets

Add these secrets to your GitHub repository:

### SMTP Configuration (for nightly alerts)
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

### Deployment Tokens
```
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id
RAILWAY_TOKEN=your-railway-token
```

## 🎯 Usage Examples

### Running Manual E2E Tests
1. Go to GitHub Actions
2. Select "Manual E2E Testing"
3. Click "Run workflow"
4. Choose test suite and environment
5. Review results in artifacts

### Nightly Monitoring
- Check GitHub Issues for nightly E2E failures
- Review email alerts for critical issues
- Monitor auto-closure of resolved issues

### Production Deployment
```bash
# Tag a release
git tag v1.0.2 -m "Feature: Enhanced chat UI"
git push origin v1.0.2

# GitHub Actions automatically:
# 1. Runs validation
# 2. Deploys to production
# 3. Runs health checks
# 4. Reports status
```

## 📊 Success Metrics

### Core Validation
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors/warnings
- ✅ 100% unit test pass rate
- ✅ Successful production build

### E2E Validation
- ✅ Cross-browser compatibility
- ✅ Mobile responsiveness
- ✅ Chat functionality
- ✅ User journey completion

### Deployment
- ✅ < 5 minute deployment time
- ✅ 100% deployment success rate
- ✅ Post-deployment health checks pass
- ✅ Zero downtime deployments

## 🚨 Troubleshooting

### Core Validation Fails
1. **STOP** - Do not merge/deploy
2. Fix the blocking issue locally
3. Run `./scripts/staging-validation.sh`
4. Push fix and re-run CI

### E2E Validation Fails
1. **Review** - Check test artifacts
2. **Continue** - Deployment is not blocked
3. **Schedule** - Fix in next sprint
4. **Monitor** - Watch for user impact

### Nightly E2E Alerts
1. **Check** - GitHub issue created
2. **Review** - Email with test output
3. **Prioritize** - Based on user impact
4. **Fix** - During regular development cycle

## 🔄 Continuous Improvement

### Weekly Reviews
- Review E2E failure patterns
- Update test coverage
- Optimize pipeline performance

### Monthly Audits
- Review deployment success rates
- Analyze failure root causes
- Update monitoring thresholds

### Quarterly Updates
- Evaluate new testing tools
- Review security practices
- Optimize infrastructure costs

---

*This CI/CD pipeline ensures Atlas AI maintains the highest quality standards while enabling rapid, confident development.*
