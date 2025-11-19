# Conversation Deletion Sync - Best Practices Review

## ❌ Current Implementation Issues

### 1. **Polling Fallback (10-second intervals)**
**Problem**: Not scalable, inefficient, creates unnecessary database load
```typescript
// ❌ BAD: Polling every 10 seconds
setInterval(async () => {
  const { data: remoteConvs } = await supabase
    .from('conversations')
    .select('id, deleted_at')
    .eq('user_id', userId);
  // ... compare and sync
}, 10000);
```

**Issues**:
- Creates constant database queries even when nothing changed
- Doesn't scale with many users
- Wastes bandwidth and battery on mobile
- 10-second delay is noticeable to users

### 2. **RLS Policy Workaround (30-second window)**
**Problem**: Temporarily exposes deleted data, security concern
```sql
-- ❌ BAD: Time-window hack
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

**Issues**:
- Exposes deleted conversations for 30 seconds
- Not a clean solution
- Could be a security/privacy concern

## ✅ Best Practice Solutions

### Solution 1: REPLICA IDENTITY FULL (Recommended)
**Why**: Ensures UPDATE events contain both old and new row data, allowing Realtime to work properly with RLS.

**Implementation**:
```sql
-- ✅ GOOD: Enable replica identity for realtime updates
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- ✅ GOOD: Proper RLS policy (no time window needed)
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL
);

-- Realtime will still receive UPDATE events because REPLICA IDENTITY FULL
-- ensures the event payload contains the row data even if RLS hides it
```

**Benefits**:
- ✅ No polling needed
- ✅ Instant sync (<1 second)
- ✅ No security concerns
- ✅ Scales infinitely
- ✅ Already used for `profiles` and `messages` tables

### Solution 2: Separate Deletion Events Table
**Why**: Decouples deletion tracking from the main table, avoids RLS conflicts.

**Implementation**:
```sql
-- Create a lightweight deletion events table
CREATE TABLE conversation_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id)
);

-- RLS policy (always visible to owner)
CREATE POLICY "users_see_own_deletion_events" 
ON conversation_deletion_events
FOR SELECT USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_deletion_events;
ALTER TABLE conversation_deletion_events REPLICA IDENTITY FULL;
```

**Frontend**:
```typescript
// Listen for deletion events
channel.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'conversation_deletion_events',
  filter: `user_id=eq.${userId}`
}, async (payload) => {
  const deletedId = payload.new.conversation_id;
  // Mark as deleted locally
  await atlasDB.conversations.update(deletedId, {
    deletedAt: payload.new.deleted_at
  });
  // Trigger UI update
  window.dispatchEvent(new CustomEvent('conversationDeleted', {
    detail: { conversationId: deletedId }
  }));
});
```

**Benefits**:
- ✅ Clean separation of concerns
- ✅ No RLS conflicts
- ✅ Easy to add metadata (who deleted, reason, etc.)
- ✅ Can be used for audit trail

### Solution 3: Use Supabase Database Webhooks
**Why**: Server-side webhook can broadcast to all connected clients via a separate channel.

**Implementation**:
```sql
-- Create webhook function
CREATE OR REPLACE FUNCTION notify_conversation_deleted()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'conversation_deleted',
    json_build_object(
      'conversation_id', NEW.id,
      'user_id', NEW.user_id,
      'deleted_at', NEW.deleted_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER conversation_deleted_notify
AFTER UPDATE OF deleted_at ON conversations
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION notify_conversation_deleted();
```

**Benefits**:
- ✅ Works regardless of RLS
- ✅ Can add custom logic
- ✅ More control over the event

## 🎯 Recommended Implementation

**Use Solution 1 (REPLICA IDENTITY FULL)** because:
1. ✅ Already proven to work (used for profiles/messages)
2. ✅ Simplest implementation
3. ✅ No schema changes needed
4. ✅ No additional tables
5. ✅ Follows Supabase best practices

## 📋 Migration Steps

1. **Add REPLICA IDENTITY FULL**:
```sql
ALTER TABLE conversations REPLICA IDENTITY FULL;
```

2. **Remove polling fallback** from `useRealtimeConversations.ts`

3. **Keep the UPDATE event listener** (already implemented correctly)

4. **Test**: Delete on Device A → Should sync to Device B instantly

## 🔍 Why Current Code Works But Isn't Optimal

The current implementation works because:
- ✅ UPDATE event listener is correctly implemented
- ✅ Fallback polling catches missed events

But it's not optimal because:
- ❌ Polling is inefficient
- ❌ 10-second delay is noticeable
- ❌ Doesn't scale well
- ❌ Wastes resources

## ✅ Final Recommendation

**Immediate fix**: Add `REPLICA IDENTITY FULL` to conversations table
**Remove**: The 10-second polling fallback
**Keep**: The UPDATE event listener (it's correct)

This will give you:
- ✅ Instant sync (<1 second)
- ✅ No unnecessary queries
- ✅ Scales to millions of users
- ✅ Follows Supabase best practices
- ✅ Consistent with existing codebase patterns
