# 🛑 Atlas Rollback Notification System Setup

## Overview
This system provides automatic Slack + email alerts for database rollback operations in Atlas. It includes a reusable notification script and a comprehensive manual rollback workflow with user inputs and safety confirmations.

## 📁 Files Created

### 1. Notification Script
- **File**: `scripts/notify-rollback.sh`
- **Purpose**: Reusable script for sending Slack + email notifications
- **Features**: 
  - Slack webhook integration
  - Email via Supabase Edge Function (cicd-alert)
  - GitHub context integration
  - JSON payload formatting
  - Error handling (non-blocking)

### 2. Manual Rollback Workflow
- **File**: `.github/workflows/manual-rollback.yml`
- **Purpose**: GitHub Actions workflow for manual database rollbacks
- **Features**:
  - User input validation (requires typing "ROLLBACK" to confirm)
  - Environment selection (staging/production)
  - Reason input field
  - Automatic notifications at each step
  - SQL rollback execution
  - Comprehensive error handling

### 3. Rollback Migration
- **File**: `supabase/migrations/20250914_rollback_subscription_columns.sql`
- **Purpose**: SQL script to rollback subscription column changes
- **Features**:
  - Safe column and index removal
  - Migration logging
  - Idempotent operations

## 🔧 Required GitHub Secrets

Set these secrets in your GitHub repository settings:

### 1. SLACK_WEBHOOK_URL
- **Purpose**: Slack incoming webhook for your #alerts channel
- **Format**: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`
- **Setup**: 
  1. Go to your Slack workspace
  2. Create a new app or use existing one
  3. Add "Incoming Webhooks" feature
  4. Create webhook for your alerts channel
  5. Copy the webhook URL

### 2. CICD_ALERT_URL
- **Purpose**: Your Supabase Edge Function URL for email alerts
- **Format**: `https://your-project.supabase.co/functions/v1/cicd-alert`
- **Note**: This should match your existing cicd-alert function URL

### 3. CICD_ALERT_TOKEN
- **Purpose**: Bearer token for authenticating with the cicd-alert function
- **Format**: Your Supabase Service Role Key or dedicated secret
- **Note**: This should match your existing cicd-alert authentication

### 4. SUPABASE_DB_URL
- **Purpose**: Direct PostgreSQL connection string for automatic SQL execution
- **Format**: `postgres://user:password@host:port/database`
- **Note**: Required for automatic rollback execution

## 🚀 How to Use

### Manual Rollback via GitHub Actions

1. **Go to GitHub Actions**:
   - Navigate to your repository
   - Click "Actions" tab
   - Find "Manual Rollback" workflow

2. **Trigger the Workflow**:
   - Click "Run workflow"
   - Select environment (staging/production)
   - Type "ROLLBACK" in the confirmation field
   - Enter reason for rollback
   - Click "Run workflow"

3. **Monitor Progress**:
   - Watch the workflow execution
   - Check Slack for notifications
   - Check email for detailed alerts
   - Review logs for any issues

### Notification Flow

The system sends notifications at three key points:

1. **STARTED**: When rollback begins
   - Includes environment, actor, reason, SHA, workflow URL
   - Sent to both Slack and email

2. **SUCCEEDED**: When rollback completes successfully
   - Confirms successful completion
   - Includes execution details

3. **FAILED**: When rollback encounters errors
   - Alerts team to issues
   - Includes error context and troubleshooting info

## 📧 Email Recipients

Default recipients (configurable via `RECIPIENTS` env var):
- `admin@otiumcreations.com`
- `rima@otiumcreations.com`

## 🔍 Testing

### Test the Notification Script
```bash
# Test with mock data
export GITHUB_REPOSITORY="your-org/your-repo"
export GITHUB_RUN_ID="12345"
export GITHUB_SHA="abc123def456"
export GITHUB_ACTOR="your-username"

# Test different statuses
./scripts/notify-rollback.sh "STARTED" "production" "Test rollback"
./scripts/notify-rollback.sh "SUCCEEDED" "staging" "Test completed"
./scripts/notify-rollback.sh "FAILED" "production" "Test error"
```

### Test the Workflow
1. Set up all required secrets
2. Trigger the manual rollback workflow
3. Use a test environment first
4. Verify notifications are received
5. Check rollback SQL execution

## 🛡️ Safety Features

### Confirmation Required
- Must type "ROLLBACK" exactly to confirm
- Prevents accidental rollbacks
- Clear warning about destructive operation

### Environment Selection
- Choose between staging and production
- Prevents wrong environment rollbacks
- Clear environment labeling in notifications

### Comprehensive Logging
- All operations logged to migration_log table
- GitHub Actions logs for audit trail
- Notification history in Slack/email

### Error Handling
- Non-blocking notification failures
- Detailed error messages
- Rollback status tracking

## 🔧 Customization

### Adding More Recipients
Update the `RECIPIENTS` environment variable in the workflow:
```yaml
env:
  RECIPIENTS: "admin@otiumcreations.com,rima@otiumcreations.com,dev@otiumcreations.com"
```

### Customizing Slack Messages
Modify the `payload_text` in `scripts/notify-rollback.sh`:
```bash
payload_text="🛑 *Atlas Rollback ${STATUS}*\n• *Env:* ${ENV_NAME}\n• *By:* ${ACTOR}\n• *Reason:* ${REASON}\n• *SHA:* ${SHA}\n• *Workflow:* ${WF_URL}\n• *Time (UTC):* $(ts)"
```

### Adding More Rollback Scripts
Create additional rollback migration files:
```sql
-- supabase/migrations/YYYYMMDD_rollback_[feature].sql
-- Follow the same pattern as 20250914_rollback_subscription_columns.sql
```

## 📊 Monitoring

### Slack Notifications
- Real-time alerts in your #alerts channel
- Rich formatting with emojis and links
- Clickable workflow URLs for quick access

### Email Notifications
- Detailed information via Supabase Edge Function
- Professional formatting
- Multiple recipient support

### GitHub Actions Logs
- Complete execution history
- Error details and stack traces
- Audit trail for compliance

## 🚨 Troubleshooting

### Common Issues

1. **Slack notifications not working**:
   - Check SLACK_WEBHOOK_URL secret
   - Verify webhook is active in Slack
   - Check Slack app permissions

2. **Email notifications not working**:
   - Check CICD_ALERT_URL and CICD_ALERT_TOKEN secrets
   - Verify cicd-alert function is deployed
   - Check Supabase Edge Function logs

3. **SQL rollback failing**:
   - Check SUPABASE_DB_URL secret format
   - Verify database connectivity
   - Check rollback SQL file exists

4. **Workflow not triggering**:
   - Ensure you typed "ROLLBACK" exactly
   - Check workflow permissions
   - Verify secrets are set

### Debug Mode
Add debug output to the notification script:
```bash
# Add this to scripts/notify-rollback.sh for debugging
echo "DEBUG: STATUS=$STATUS, ENV=$ENV_NAME, REASON=$REASON"
echo "DEBUG: SLACK_URL=${SLACK_WEBHOOK_URL:+SET}"
echo "DEBUG: CICD_URL=${CICD_ALERT_URL:+SET}"
```

## ✅ Verification Checklist

- [ ] All GitHub secrets are set correctly
- [ ] Slack webhook is active and tested
- [ ] Email notifications are working
- [ ] Manual rollback workflow is accessible
- [ ] Rollback SQL file exists and is valid
- [ ] Notification script is executable
- [ ] Test rollback in staging environment
- [ ] Verify all team members receive notifications
- [ ] Document any customizations made

## 🎯 Next Steps

1. **Set up GitHub secrets** (see Required GitHub Secrets section)
2. **Test in staging environment** first
3. **Train team** on rollback procedures
4. **Monitor first production rollback** closely
5. **Gather feedback** and iterate on the system

---

**🎉 Your Atlas rollback notification system is now ready for production use!**