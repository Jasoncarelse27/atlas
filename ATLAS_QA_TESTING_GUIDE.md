# 🎯 Atlas Tier QA Testing Guide

## Overview
This guide provides comprehensive testing procedures for Atlas's tier enforcement system, ensuring Free, Core, and Studio tiers work correctly before soft launch.

## 🚀 Quick Start

### 1. Set Up Test Users
```bash
# Apply test user seed
supabase db remote commit supabase/seeds/seed-test-users.sql
```

### 2. Run QA Tests
```bash
# Run automated QA script
./scripts/qa-tier-testing.sh
```

### 3. Manual Testing
Open http://localhost:5175 and test with:
- **Free**: `freeuser@test.com` / `testpass123`
- **Core**: `coreuser@test.com` / `testpass123`  
- **Studio**: `studiouser@test.com` / `testpass123`

## 📋 Test User Accounts

| Tier | Email | Password | Features |
|------|-------|----------|----------|
| **Free** | `freeuser@test.com` | `testpass123` | 15 messages, text only |
| **Core** | `coreuser@test.com` | `testpass123` | Unlimited, voice + image |
| **Studio** | `studiouser@test.com` | `testpass123` | Unlimited, all features + Opus |

## 🧪 Comprehensive Test Checklist

### ✅ Free Tier Testing
- [ ] **Mic Button**: Disabled (greyed out)
- [ ] **Image Button**: Disabled (greyed out)
- [ ] **Text Input**: Limited to 15 messages/month
- [ ] **AI Model**: Claude Haiku
- [ ] **Upgrade Modal**: Shows when clicking mic/image
- [ ] **Message Counter**: Shows remaining messages

### ✅ Core Tier Testing
- [ ] **Mic Button**: Enabled (blue/active)
- [ ] **Image Button**: Enabled (green/active)
- [ ] **Text Input**: Unlimited messages
- [ ] **AI Model**: Claude Sonnet
- [ ] **Voice Recording**: Works and transcribes
- [ ] **Image Upload**: Works and analyzes
- [ ] **Upgrade Modal**: Shows for Studio features

### ✅ Studio Tier Testing
- [ ] **Mic Button**: Enabled (blue/active)
- [ ] **Image Button**: Enabled (green/active)
- [ ] **Text Input**: Unlimited messages
- [ ] **AI Model**: Claude Opus
- [ ] **Voice Recording**: Works with premium quality
- [ ] **Image Upload**: Works with detailed analysis
- [ ] **Priority Support**: Available
- [ ] **All Features**: Unlocked

## 🔄 Upgrade Flow Testing

### Free → Core Upgrade
1. Log in as `freeuser@test.com`
2. Click mic button → Should show upgrade modal
3. Click "Upgrade Now" → Should redirect to Paddle checkout
4. Complete sandbox payment → Should update to Core tier
5. Verify mic/image buttons are now enabled

### Core → Studio Upgrade
1. Log in as `coreuser@test.com`
2. Access premium features → Should show Studio upgrade modal
3. Complete upgrade → Should unlock Opus model
4. Verify all premium features are available

## 🤖 AI Model Routing Verification

### Backend Logs Check
Monitor backend console for correct model selection:

```bash
# Free tier should log:
"Using Claude Haiku for free tier user"

# Core tier should log:
"Using Claude Sonnet for core tier user"

# Studio tier should log:
"Using Claude Opus for studio tier user"
```

### Response Quality Check
- **Haiku**: Fast, concise responses
- **Sonnet**: Balanced reasoning and detail
- **Opus**: Comprehensive, detailed responses

## 💾 Database Verification

### Check User Profiles
```sql
SELECT email, subscription_tier, subscription_status 
FROM profiles 
WHERE email IN ('freeuser@test.com', 'coreuser@test.com', 'studiouser@test.com');
```

### Check Conversations
```sql
SELECT c.title, p.subscription_tier, COUNT(m.id) as message_count
FROM conversations c
JOIN profiles p ON c.user_id = p.id
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE p.email IN ('freeuser@test.com', 'coreuser@test.com', 'studiouser@test.com')
GROUP BY c.id, c.title, p.subscription_tier;
```

## 🎙️ Audio Feature Testing

### Voice Recording Test
1. **Free Tier**: Click mic → Should show upgrade modal
2. **Core/Studio**: Click mic → Should start recording
3. **Test Phrase**: "Hello Atlas, this is a voice test"
4. **Expected**: Audio transcribed and AI responds

### Audio Quality Check
- **Core**: Standard quality transcription
- **Studio**: Enhanced quality with better context

## 🖼️ Image Feature Testing

### Image Upload Test
1. **Free Tier**: Click image button → Should show upgrade modal
2. **Core/Studio**: Click image button → Should open file picker
3. **Test Image**: Upload a photo or screenshot
4. **Expected**: AI analyzes image and responds

### Image Analysis Quality
- **Core**: Basic image description and analysis
- **Studio**: Detailed analysis with context and insights

## 📊 Performance Testing

### Message Limits
- **Free**: Test 15 message limit enforcement
- **Core/Studio**: Test unlimited messaging
- **Upgrade Prompts**: Should appear at 10 messages for Free tier

### Response Times
- **Haiku**: < 2 seconds
- **Sonnet**: < 5 seconds  
- **Opus**: < 10 seconds

## 🔧 Troubleshooting

### Common Issues

#### Mic Button Not Working
```bash
# Check browser console for errors
# Verify microphone permissions
# Check tier enforcement logic
```

#### Image Upload Failing
```bash
# Check file size limits
# Verify image format support
# Check tier access permissions
```

#### Wrong AI Model
```bash
# Check user profile subscription_tier
# Verify model routing logic
# Check backend logs
```

### Debug Commands
```bash
# Check user profile
curl -H "Authorization: Bearer $TOKEN" \
  "$BACKEND_URL/v1/user_profiles/$USER_ID"

# Check tier limits
curl -H "Authorization: Bearer $TOKEN" \
  "$BACKEND_URL/v1/tier-limits/$USER_ID"
```

## 🧹 Cleanup

### Remove Test Users
```bash
# Rollback test users
supabase db remote commit supabase/seeds/rollback-test-users.sql
```

### Reset Database
```bash
# Reset to clean state
supabase db reset
```

## ✅ Pass/Fail Criteria

### ✅ PASS Criteria
- Free tier blocks mic/image with upgrade modal
- Core tier enables mic/image with Sonnet model
- Studio tier enables all features with Opus model
- Upgrade flow redirects to Paddle checkout
- Message limits enforced correctly
- AI model routing works per tier

### ❌ FAIL Criteria
- Wrong features unlocked for tier
- Mic/image buttons don't work when they should
- Backend routes to wrong AI model
- Upgrade flow doesn't work
- Message limits not enforced
- Database inconsistencies

## 🚀 Production Readiness

### Pre-Launch Checklist
- [ ] All tier tests pass
- [ ] Upgrade flow works end-to-end
- [ ] Paddle sandbox integration tested
- [ ] Database migrations applied
- [ ] CI/CD workflows passing
- [ ] Monitoring and alerts active
- [ ] Performance benchmarks met

### Launch Day
- [ ] Monitor Slack alerts
- [ ] Check user signups
- [ ] Verify tier enforcement
- [ ] Monitor AI model usage
- [ ] Track upgrade conversions

---

**Atlas is ready for soft launch when all tests pass! 🎉**
