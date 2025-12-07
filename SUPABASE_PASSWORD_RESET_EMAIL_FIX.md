# 🔧 Supabase Password Reset Email Fix Guide

## Problem
Users are not receiving password reset emails from Supabase.

## Root Causes

1. **Supabase Dashboard Configuration Missing**
   - Site URL not set to production domain
   - Redirect URLs not configured
   - SMTP not configured (using default email service)

2. **Email Service Limitations**
   - Supabase's default email service has rate limits (2 emails/hour in config)
   - May go to spam without proper SMTP configuration

3. **Security Best Practices**
   - Code now prevents email enumeration (doesn't reveal if email exists)

## ✅ Fix Steps

### Step 1: Configure Supabase Dashboard (REQUIRED)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Navigate to**: Authentication → URL Configuration

4. **Set Site URL**:
   ```
   https://your-production-domain.com
   ```
   Example: `https://atlas.vercel.app` or your Railway domain

5. **Add Redirect URLs**:
   ```
   https://your-production-domain.com/reset-password
   https://your-production-domain.com/**
   ```
   Add both:
   - Exact path: `/reset-password`
   - Wildcard: `/**` (for all auth redirects)

### Step 2: Configure SMTP (RECOMMENDED)

**Option A: Use Supabase's Default Email Service** (Current)
- ✅ Already working, but limited
- ⚠️ Rate limit: 2 emails/hour (config shows this)
- ⚠️ May go to spam
- ✅ No setup required

**Option B: Configure Custom SMTP** (Recommended for Production)

1. **Go to**: Authentication → Email Templates → SMTP Settings

2. **Enable SMTP** and configure:
   ```
   Host: smtp.sendgrid.net (or your SMTP provider)
   Port: 587
   User: apikey (for SendGrid) or your SMTP username
   Password: [Your SMTP API key]
   Sender Email: noreply@yourdomain.com
   Sender Name: Atlas
   ```

3. **Recommended SMTP Providers**:
   - **SendGrid** (Free tier: 100 emails/day)
   - **Mailgun** (Free tier: 5,000 emails/month)
   - **AWS SES** (Pay as you go, very cheap)
   - **Postmark** (Paid, excellent deliverability)

### Step 3: Check Email Rate Limits

Current config shows: `email_sent = 2` per hour

**To increase**:
1. Go to Supabase Dashboard → Authentication → Rate Limits
2. Increase "Email Sent" limit (recommended: 10-20/hour)
3. Or configure SMTP (bypasses this limit)

### Step 4: Verify Email Delivery

1. **Check Supabase Logs**:
   - Go to: Logs → Auth Logs
   - Look for password reset attempts
   - Check for errors

2. **Test Email**:
   - Try password reset with your own email
   - Check spam folder
   - Check Supabase logs for delivery status

3. **Common Issues**:
   - ✅ Email sent but in spam → Configure SMTP with proper domain
   - ✅ Rate limited → Wait or increase limit
   - ✅ Wrong redirect URL → Update Supabase Dashboard URLs
   - ✅ Email doesn't exist → Code now handles this gracefully

## 🔍 Debugging

### Check if Email Was Sent

1. **Supabase Dashboard**:
   - Go to: Logs → Auth Logs
   - Filter by: "Password Reset"
   - Check timestamp and status

2. **Check User Email**:
   - Verify email exists in `auth.users` table
   - Check if email is confirmed

3. **Test Locally**:
   ```bash
   # Check Supabase local email server (if running locally)
   # Go to: http://localhost:54324 (Inbucket)
   ```

### Code Improvements Made

✅ **Better Error Messages**:
- Rate limit errors show helpful message
- Doesn't reveal if email exists (security)
- Always shows success message (prevents enumeration)

✅ **Security**:
- Prevents email enumeration attacks
- Consistent success message regardless of email existence

## 📋 Checklist

- [ ] Site URL configured in Supabase Dashboard
- [ ] Redirect URLs added (`/reset-password` and `/**`)
- [ ] SMTP configured (recommended) OR default service verified
- [ ] Rate limits checked/increased if needed
- [ ] Tested password reset flow
- [ ] Checked spam folder
- [ ] Verified email in Supabase logs

## 🚨 Immediate Actions

1. **Right Now**: Configure Site URL and Redirect URLs in Supabase Dashboard
2. **This Week**: Set up SMTP for better deliverability
3. **Monitor**: Check Supabase Auth logs for password reset attempts

## 📞 Support

If emails still don't work after configuration:
1. Check Supabase Status: https://status.supabase.com
2. Review Supabase Auth Logs
3. Test with different email providers (Gmail, Outlook, etc.)
4. Consider using custom SMTP for better deliverability

