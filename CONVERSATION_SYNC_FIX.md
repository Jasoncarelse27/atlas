# Conversation Deletion Sync Fix

## Problem
When you delete a conversation on one device (mobile/web), it doesn't immediately sync to other devices. The conversation reappears on refresh or stays visible on the other device.

## Root Cause
The Supabase Row Level Security (RLS) policy immediately hides soft-deleted conversations (`deleted_at IS NOT NULL`). This prevents the UPDATE event from reaching other connected clients through Supabase Realtime.

```sql
-- Current problematic policy
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL  -- This filters out deleted convos immediately
);
```

When Device A deletes a conversation:
1. ✅ Device A sets `deleted_at` timestamp
2. ❌ Supabase RLS immediately hides the conversation
3. ❌ Device B never receives the UPDATE event
4. ❌ Device B still shows the deleted conversation

## Solution

### Option 1: Time-Window Approach (Recommended)
Allow viewing recently deleted conversations for 30 seconds to ensure realtime events propagate:

```sql
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id 
  AND (
    deleted_at IS NULL 
    OR 
    (deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 seconds')
  )
);
```

### Option 2: Separate Policies Approach
Create separate policies for normal queries vs realtime subscriptions:

```sql
-- Regular queries only see non-deleted
CREATE POLICY "conversations_select_active" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL
);

-- Realtime can see all (for UPDATE events)
CREATE POLICY "conversations_realtime_updates" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id
);
```

## Implementation Steps

1. **Run the migration**: 
   ```bash
   supabase migration new fix_realtime_soft_delete
   # Copy the SQL from above
   supabase db push
   ```

2. **Test the fix**:
   - Open Atlas on two devices/browsers
   - Delete a conversation on Device A
   - Device B should see it disappear within 1-2 seconds

3. **Verify in logs**:
   - Check browser console for `[Realtime] ✅ Conversation soft deleted`
   - Check for `conversationDeleted` events firing

## Alternative Frontend-Only Fix (If DB Changes Not Possible)

If you can't modify the database policies, you can implement a polling-based sync:

```typescript
// In useRealtimeConversations.ts
useEffect(() => {
  // Poll for deleted conversations every 5 seconds
  const interval = setInterval(async () => {
    const remoteConvs = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);
    
    // Find conversations that exist locally but not remotely
    const localConvs = await atlasDB.conversations.where('userId').equals(userId).toArray();
    const remoteIds = new Set(remoteConvs.data?.map(c => c.id) || []);
    
    for (const local of localConvs) {
      if (!remoteIds.has(local.id) && !local.deletedAt) {
        // Mark as deleted locally
        await atlasDB.conversations.update(local.id, {
          deletedAt: new Date().toISOString()
        });
        
        // Trigger UI update
        window.dispatchEvent(new CustomEvent('conversationDeleted', {
          detail: { conversationId: local.id }
        }));
      }
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [userId]);
```

## Testing Checklist

- [ ] Delete on Web → Mobile updates within 2 seconds
- [ ] Delete on Mobile → Web updates within 2 seconds  
- [ ] Delete while offline → Syncs when back online
- [ ] Multiple deletes in quick succession → All sync properly
- [ ] Check Supabase logs for UPDATE events firing
- [ ] Verify no conversations "resurrect" after deletion

## Why This Happens

This is a common issue with soft-delete systems + realtime + RLS:
- Hard deletes would send DELETE events (but lose data)
- Soft deletes with restrictive RLS hide data too quickly
- The time-window approach balances security and functionality
