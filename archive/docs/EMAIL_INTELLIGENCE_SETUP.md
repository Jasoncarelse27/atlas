# 📬 Atlas AI Email Intelligence Setup Guide

This guide will help you set up the complete email intelligence system for Atlas AI, including automated welcome emails, upgrade nudges, inactivity reminders, and weekly summaries.

## 🎯 Overview

The email intelligence system consists of:
- **mailerService.ts**: Client-side email service with MailerLite integration
- **Supabase Edge Functions**: Server-side email triggers
- **SQL Triggers**: Automated email sending based on user actions
- **Email Test Checklist**: UI component for testing email flows

## 📋 Prerequisites

1. **MailerLite Account**: Sign up at [mailerlite.com](https://mailerlite.com)
2. **Supabase Project**: With Edge Functions enabled
3. **Environment Variables**: Configured in your project

## 🔧 Setup Steps

### 1. Environment Variables

Add these to your `.env` file:

```env
# MailerLite Configuration
VITE_MAILERLITE_API_KEY=your_mailerlite_api_key

# Supabase Configuration (already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. MailerLite Setup

1. **Get API Key**:
   - Go to MailerLite Dashboard → Integrations → API
   - Copy your API key

2. **Create Email Templates**:
   - **Welcome Template**: Create a template for welcome emails
   - **Upgrade Nudge Template**: Create a template for upgrade prompts
   - **Inactivity Reminder Template**: Create a template for re-engagement
   - **Weekly Summary Template**: Create a template for weekly insights

3. **Create Automation Flows**:
   - **Upgrade Nudge Flow**: Triggered when usage limit reached
   - **Inactivity Reminder Flow**: Triggered after 7 days of inactivity

### 3. Supabase Database Setup

Run the SQL setup script:

```bash
# Connect to your Supabase project
supabase db reset

# Run the email setup SQL
psql -h your-db-host -U postgres -d postgres -f SUPABASE_EMAIL_SETUP.sql
```

Or copy and paste the contents of `SUPABASE_EMAIL_SETUP.sql` into your Supabase SQL editor.

### 4. Deploy Edge Functions

Deploy all email-related Edge Functions:

```bash
# Deploy welcome email function
supabase functions deploy send-welcome

# Deploy upgrade nudge function
supabase functions deploy send-upgrade-nudge

# Deploy inactivity reminder function
supabase functions deploy send-inactivity-reminder

# Deploy weekly summary function
supabase functions deploy send-weekly-summary
```

### 5. Configure Supabase Settings

In your Supabase dashboard, set these configuration values:

```sql
-- Set your project URL
ALTER SYSTEM SET app.supabase_url = 'https://your-project-ref.supabase.co';

-- Set your service role key
ALTER SYSTEM SET app.service_role_key = 'your-service-role-key';

-- Reload configuration
SELECT pg_reload_conf();
```

## 🧪 Testing Email Flows

### Using the Email Test Checklist

1. **Import the Component**:
   ```tsx
   import EmailTestChecklist from './components/EmailTestChecklist';
   
   // Use in your app
   <EmailTestChecklist />
   ```

2. **Test Each Flow**:
   - Enter a test email address
   - Click "Test" for each email flow
   - Verify emails are received
   - Check test results in the UI

### Manual Testing

Test individual email functions:

```typescript
import { mailerService } from './services/mailerService';

// Test welcome email
const result = await mailerService.sendWelcomeEmail({
  email: 'test@example.com',
  name: 'Test User'
});

// Test upgrade nudge
const nudgeResult = await mailerService.sendUpgradeNudge({
  email: 'test@example.com',
  name: 'Test User'
}, {
  usage_count: 10,
  usage_limit: 10
});

// Test weekly summary
const summaryResult = await mailerService.sendWeeklySummary({
  email: 'test@example.com',
  name: 'Test User'
}, {
  messageCount: 25,
  conversationCount: 5,
  topTopics: ['AI Development', 'React'],
  insights: ['You\'re in the top 10% of users!'],
  usageStats: {
    totalMessages: 150,
    averageResponseTime: 2.3,
    favoriteModel: 'Claude'
  }
});
```

## 📊 Email Analytics

### View Email Logs

```sql
-- View all email logs
SELECT * FROM email_logs ORDER BY sent_at DESC;

-- View email analytics
SELECT * FROM email_analytics;

-- View email success rates by flow type
SELECT 
  flow_type,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
  ROUND(COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM email_logs
GROUP BY flow_type;
```

### Monitor User Activity

```sql
-- View user activity
SELECT * FROM user_activity ORDER BY last_activity DESC;

-- Find inactive users
SELECT u.email, ua.last_activity
FROM auth.users u
JOIN user_activity ua ON u.id = ua.user_id
WHERE ua.last_activity < NOW() - INTERVAL '7 days';
```

## 🔄 Automated Email Flows

### 1. Welcome Email
- **Trigger**: New user registration
- **Function**: `handle_new_user()`
- **Edge Function**: `send-welcome`

### 2. Upgrade Nudge
- **Trigger**: Usage limit reached
- **Function**: `check_usage_limit()`
- **Edge Function**: `send-upgrade-nudge`
- **Frequency**: Once per 24 hours

### 3. Inactivity Reminder
- **Trigger**: 7 days of inactivity
- **Function**: `send_inactivity_reminders()`
- **Edge Function**: `send-inactivity-reminder`
- **Frequency**: Weekly CRON job

### 4. Weekly Summary
- **Trigger**: Weekly CRON job
- **Function**: `send_weekly_summaries()`
- **Edge Function**: `send-weekly-summary`
- **Frequency**: Every Monday

## 🚀 Production Deployment

### 1. Set Up CRON Jobs

For inactivity reminders and weekly summaries, set up CRON jobs:

```sql
-- Run inactivity reminders (daily at 9 AM)
SELECT cron.schedule('inactivity-reminders', '0 9 * * *', 'SELECT send_inactivity_reminders();');

-- Run weekly summaries (Mondays at 10 AM)
SELECT cron.schedule('weekly-summaries', '0 10 * * 1', 'SELECT send_weekly_summaries();');
```

### 2. Monitor Email Performance

Set up monitoring for:
- Email delivery rates
- User engagement metrics
- Error rates and failed sends
- Database performance

### 3. Email Templates

Customize email templates in MailerLite:
- **Brand Colors**: Use your brand colors
- **Logo**: Add your Atlas AI logo
- **Content**: Customize messaging for your audience
- **CTA Buttons**: Optimize call-to-action buttons

## 🛠️ Troubleshooting

### Common Issues

1. **Emails Not Sending**:
   - Check MailerLite API key
   - Verify Edge Function deployment
   - Check Supabase logs

2. **Database Errors**:
   - Ensure RLS policies are correct
   - Check user permissions
   - Verify trigger functions

3. **Template Issues**:
   - Verify template IDs in MailerLite
   - Check email content generation
   - Test with simple templates first

### Debug Commands

```bash
# Check Edge Function logs
supabase functions logs send-welcome

# Test database connection
supabase db ping

# Check email logs
psql -h your-db-host -U postgres -d postgres -c "SELECT * FROM email_logs LIMIT 10;"
```

## 📈 Optimization Tips

1. **Email Timing**: Send emails at optimal times for your users
2. **Personalization**: Use user data to personalize content
3. **A/B Testing**: Test different subject lines and content
4. **Segmentation**: Segment users based on activity and preferences
5. **Analytics**: Track open rates, click rates, and conversions

## 🔒 Security Considerations

1. **API Keys**: Store securely in environment variables
2. **Rate Limiting**: Implement rate limiting for email sends
3. **User Consent**: Ensure users have opted in to emails
4. **Data Privacy**: Comply with GDPR and other privacy regulations
5. **Email Validation**: Validate email addresses before sending

## 📚 Additional Resources

- [MailerLite API Documentation](https://developers.mailerlite.com/)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Email Marketing Best Practices](https://mailerlite.com/blog/email-marketing-best-practices)

---

**🎉 Congratulations!** Your Atlas AI email intelligence system is now ready to engage users with automated, personalized emails that drive engagement and growth.
