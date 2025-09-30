# 🎤 Atlas Audio QA Execution Plan

## 📋 **STEP 1: Database Migration (Manual)**

### **Action Required:**
1. Open Supabase Dashboard: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql
2. Copy the contents of `run_audio_migration.sql`
3. Paste and execute in the SQL Editor
4. Verify success message: "Audio events table created successfully"

### **Verification:**
```sql
-- Check if table was created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'audio_events';

-- Check if policies exist
SELECT policyname FROM pg_policies 
WHERE tablename = 'audio_events';
```

---

## 📱 **STEP 2: Local Testing (iOS Simulator)**

### **Commands to Run:**
```bash
# Start iOS simulator
npx expo run:ios

# Alternative: Use existing dev server
# App should be available at: http://localhost:5174/
```

### **Test Scenarios:**
1. **Permissions Flow**
   - Launch app → Should prompt for microphone access
   - Deny permission → Check error handling
   - Grant permission → Check recording starts

2. **Basic Recording**
   - Tap mic button → Should start recording
   - Speak "Hello Atlas" → Stop recording
   - Verify Claude responds with text

3. **Analytics Check**
   - Run this query in Supabase:
   ```sql
   SELECT * FROM audio_events ORDER BY created_at DESC LIMIT 5;
   ```

---

## 📱 **STEP 3: Android Testing (if available)**

### **Commands to Run:**
```bash
# Android emulator
npx expo run:android

# Or physical device via USB debugging
npx expo run:android --device
```

---

## 🔧 **STEP 4: Tier Testing**

### **Free Tier Test:**
1. Login with Free tier account
2. Record audio → Should get text response only
3. Verify NO TTS playback occurs
4. Check analytics: `audio_tts_playback` should not appear

### **Core/Studio Tier Test:**
1. Login with Core/Studio tier account
2. Record audio → Should get text response + TTS playback
3. Verify TTS plays Claude's response
4. Check analytics: `audio_tts_playback` should appear

---

## 🧪 **STEP 5: Edge Case Testing**

### **Test Cases:**
1. **Long Recording (>60s)**
   - Record for 70+ seconds
   - Should auto-stop and show toast

2. **Network Issues**
   - Turn on airplane mode mid-recording
   - Should show error toast, no crash

3. **Rapid Taps**
   - Tap mic button rapidly
   - Should debounce properly

---

## 📊 **STEP 6: Analytics Verification**

### **Key Metrics to Check:**
```sql
-- 1. Overall event counts
SELECT event_name, COUNT(*) as count
FROM audio_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_name;

-- 2. Success rates
SELECT 
  COUNT(CASE WHEN event_name = 'audio_stt_success' THEN 1 END) as successes,
  COUNT(CASE WHEN event_name IN ('audio_stt_success', 'audio_stt_fail') THEN 1 END) as total,
  ROUND(
    COUNT(CASE WHEN event_name = 'audio_stt_success' THEN 1 END)::float / 
    NULLIF(COUNT(CASE WHEN event_name IN ('audio_stt_success', 'audio_stt_fail') THEN 1 END), 0) * 100, 
    2
  ) as success_rate_percent
FROM audio_events
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 3. Tier breakdown
SELECT 
  props->>'tier' as tier,
  event_name,
  COUNT(*) as count
FROM audio_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1, 2
ORDER BY 1, 2;
```

---

## ✅ **Success Criteria**

### **Must Pass:**
- [ ] Database migration completes successfully
- [ ] iOS simulator runs without crashes
- [ ] Microphone permissions flow works
- [ ] Basic STT pipeline works (speech → text → Claude response)
- [ ] Analytics events are logged correctly
- [ ] Tier gating works (Free = text only, Core/Studio = TTS)

### **Nice to Have:**
- [ ] Android testing passes
- [ ] Edge cases handled gracefully
- [ ] TTS quality is acceptable (placeholder for now)
- [ ] No memory leaks during audio playback

---

## 🚨 **Rollback Plan**

If critical issues are found:
1. **Disable Audio Features**: Set feature flag to false
2. **Revert Edge Functions**: Deploy previous versions
3. **Database Rollback**: Drop audio_events table if needed
4. **Frontend Rollback**: Revert audio-related commits

---

## 📞 **Next Steps After QA**

Once audio QA passes:
1. **Deploy to Production**: Push audio features to live environment
2. **Monitor Analytics**: Watch for 24 hours
3. **User Feedback**: Collect initial user responses
4. **Image Pipeline**: Begin image integration work
5. **Performance Optimization**: Based on real usage data
