# 🔍 RITUAL SAVE TEST PLAN

## Test Flow:
1. Open: https://localhost:5174/rituals
2. Click any ritual
3. Select mood (before)
4. Click "Start"
5. Wait or skip through steps
6. Select mood (after)
7. Click "Complete"

## What to Check:

### Desktop Console (F12):
- Any errors in console?
- Look for: `[RitualRunner] ✅ Ritual completed`
- Or error: `Failed to log completion`

### Network Tab:
- Look for POST to `/ritual_logs`
- Status should be 200
- If 401/403: Auth issue
- If 500: Database issue

### Supabase (Quick Check):
```bash
# Check if logs are saving
supabase db pull --db-url YOUR_URL
```

## Most Likely Issues:

1. **User ID missing** - Check `user?.id` exists
2. **RLS Policy** - ritual_logs needs INSERT policy
3. **Offline mode** - Dexie saving but not syncing to Supabase
4. **Mobile specific** - Touch events conflicting

## Quick Fix If Needed:
Check RLS policy allows INSERT:
```sql
-- Should exist in ritual_logs table
CREATE POLICY "Users can insert own logs" 
ON ritual_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

**Tell me what you see in console when you complete a ritual**
