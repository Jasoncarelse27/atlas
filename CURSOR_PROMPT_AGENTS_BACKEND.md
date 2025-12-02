# CURSOR PROMPT — AGENTS BACKEND (A3 Memory + Notifications + Business Chat)

### ✅ CORRECTED VERSION — Atlas Codebase Accurate
### Matches real files, real import patterns, real SDK usage

You must follow **ALL Ultra Rules** (1–9).  
You are ONLY allowed to modify the following:

### ✅ Allowed File Changes

- CREATE: `supabase/migrations/20251202_agents_memory_notifications.sql`
- MODIFY: `backend/server.mjs`  
  (Add routes **after line 1845**, before `/api/usage-log`)
- MODIFY: `backend/routes/email-agent.mjs`  
  (Add additive hook **after line 154**, before `processedThreads.push(...)`)

### ❌ Forbidden

- Do NOT modify any existing logic in:
  - Auth
  - Chat
  - SSE streaming
  - Tier routing
  - Voice agents
  - Existing email agent pipeline
  - Dexie/offline sync
  - Mobile routing
- Do NOT change or remove any tables.
- Additive-only.

---

# ======================================================
# STEP 1 — CREATE MIGRATION FILE
# supabase/migrations/20251202_agents_memory_notifications.sql
# ======================================================

Create this file exactly. It must be **idempotent**, follow Atlas conventions,
and reference `auth.users(id)` on delete cascade.

```sql
-- ======================================================
-- Atlas Agents Dashboard Backend
-- Notifications + Business Notes + Memory Summaries
-- Additive-only migration (safe)
-- ======================================================

-- 1) User-facing notifications (Email Agent + System events)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read
  ON public.notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Business Notes (manual + agent-generated)
CREATE TABLE IF NOT EXISTS public.business_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_notes_user_created_at
  ON public.business_notes (user_id, created_at DESC);

ALTER TABLE public.business_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business notes"
  ON public.business_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business notes"
  ON public.business_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business notes"
  ON public.business_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own business notes"
  ON public.business_notes FOR DELETE
  USING (auth.uid() = user_id);

-- 3) Auto Memory Summaries (LLM short-term summaries)
CREATE TABLE IF NOT EXISTS public.memory_auto_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_auto_summaries_user_created_at
  ON public.memory_auto_summaries (user_id, created_at DESC);

ALTER TABLE public.memory_auto_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory summaries"
  ON public.memory_auto_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory summaries"
  ON public.memory_auto_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory summaries"
  ON public.memory_auto_summaries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

# ======================================================
# STEP 2 — MODIFY backend/server.mjs
# ADD NEW ROUTES AFTER LINE 1845
# BEFORE app.post('/api/usage-log' ...
# ======================================================

Insert AFTER this line:
```javascript
app.use('/api/agents/escalation', escalationAgentRouter);
```

And BEFORE:
```javascript
app.post('/api/usage-log', verifyJWT, async (req, res) => {
```

**IMPORTANT**: Check if these imports already exist at the top of the file. If they do, skip adding them. If not, add them:

```javascript
// Add these imports ONLY if they don't already exist:
import { supabase } from './config/supabaseClient.mjs';  // ✅ FIXED: ./config (not ../config)
import Anthropic from '@anthropic-ai/sdk';
// logger is already imported (line 20)
```

Add these EXACT ROUTES:

```javascript
// ======================================================
// Notifications API
// ======================================================
app.get('/api/notifications', verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { supabase } = await import('./config/supabaseClient.mjs');
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('[Notifications] Select error:', error);
      return res.status(500).json({ error: 'Failed to load notifications' });
    }

    return res.json({ notifications: data ?? [] });
  } catch (err) {
    logger.error('[Notifications] Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.post('/api/notifications/mark-read', verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notificationId } = req.body;
    if (!notificationId) {
      return res.status(400).json({ error: 'notificationId is required' });
    }

    const { supabase } = await import('./config/supabaseClient.mjs');
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[Notifications] Mark-read error:', error);
      return res.status(500).json({ error: 'Failed to mark notification as read' });
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error('[Notifications] Unexpected mark-read error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

// ======================================================
// Business Notes API
// ======================================================
app.get('/api/business-notes', verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { supabase } = await import('./config/supabaseClient.mjs');
    const { data, error } = await supabase
      .from('business_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('[BusinessNotes] Select error:', error);
      return res.status(500).json({ error: 'Failed to load notes' });
    }

    return res.json({ notes: data ?? [] });
  } catch (err) {
    logger.error('[BusinessNotes] Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.post('/api/business-notes', verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const { supabase } = await import('./config/supabaseClient.mjs');
    const { data, error } = await supabase
      .from('business_notes')
      .insert({
        user_id: userId,
        content: content.trim(),
        source: 'manual',
      })
      .select()
      .single();

    if (error) {
      logger.error('[BusinessNotes] Insert error:', error);
      return res.status(500).json({ error: 'Failed to save note' });
    }

    return res.json({ note: data });
  } catch (err) {
    logger.error('[BusinessNotes] Unexpected insert error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

// ======================================================
// Business Chat — Full Memory (A3)
// ======================================================
app.post('/api/business-chat', verifyJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const { supabase } = await import('./config/supabaseClient.mjs');
    const trimmedMessage = message.trim();

    // 1) Insert note
    const { data: insertedNote, error: insertError } = await supabase
      .from('business_notes')
      .insert({
        user_id: userId,
        content: trimmedMessage,
        source: 'manual',
      })
      .select()
      .single();

    if (insertError) {
      logger.error('[BusinessChat] Insert note error:', insertError);
      return res.status(500).json({ error: 'Failed to save note' });
    }

    // 2) Fetch last 20 notes for context
    const { data: notes, error: notesError } = await supabase
      .from('business_notes')
      .select('id, content, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (notesError) {
      logger.error('[BusinessChat] Fetch notes error:', notesError);
      return res.status(500).json({ error: 'Failed to load notes' });
    }

    const notesReversed = (notes ?? []).slice().reverse();

    // 3) Fetch latest summary (if any)
    const { data: summaries, error: summaryError } = await supabase
      .from('memory_auto_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (summaryError) {
      logger.error('[BusinessChat] Fetch summary error:', summaryError);
    }

    const latestSummary = summaries && summaries[0] ? summaries[0].summary : null;

    // 4) Call Anthropic Sonnet with compact context
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      logger.error('[BusinessChat] ANTHROPIC_API_KEY missing');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const systemPrompt = `
You are Atlas, a calm, emotionally intelligent business companion for a married founder couple (Jason and Rima).
You see a small slice of their notes and an optional short memory summary.
Your job is to respond briefly, warmly, and practically about the latest message,
and then provide an updated short summary that captures the evolving business context.

Constraints:
- Keep your reply under ~180 words.
- Keep the summary under ~2000 characters.
- Do not include sensitive data that wasn't provided.
`.trim();

    const notesText = notesReversed
      .map(n => `- [${n.source}] ${n.content}`)
      .join('\n');

    const memoryContext = latestSummary
      ? `Existing summary:\n${latestSummary}\n\n`
      : '';

    const userPrompt = `
${memoryContext}Recent business notes:
${notesText}

New message:
${trimmedMessage}

Please respond with a JSON object of the form:
{"reply": "...", "summary": "..."}

"reply" = what you want to say back to the user now.
"summary" = a refreshed short memory of the ongoing business context.
`.trim();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // ✅ FIXED: Matches codebase pattern (from intelligentTierSystem.mjs)
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Parse response
    const aiResponseText = response?.content?.[0]?.text ?? '{}';
    let reply = 'Thank you for sharing this. I am here with you.';
    let updatedSummary = latestSummary ?? '';

    try {
      const parsed = JSON.parse(aiResponseText);
      if (typeof parsed.reply === 'string') reply = parsed.reply;
      if (typeof parsed.summary === 'string') {
        // Truncate summary defensively to ~2000 chars
        updatedSummary = parsed.summary.slice(0, 2000);
      }
    } catch (parseErr) {
      logger.error('[BusinessChat] Failed to parse AI JSON:', parseErr);
      // Fallback: keep default reply + latestSummary
    }

    // 5) Upsert summary (insert new one - simple approach)
    if (updatedSummary && updatedSummary.trim().length > 0) {
      const { error: upsertError } = await supabase
        .from('memory_auto_summaries')
        .insert({
          user_id: userId,
          summary: updatedSummary.trim(),
        });

      if (upsertError) {
        logger.error('[BusinessChat] Upsert summary error:', upsertError);
      }
    }

    return res.json({
      reply,
      summary: updatedSummary,
      note: insertedNote,
    });
  } catch (err) {
    logger.error('[BusinessChat] Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});
```

---

# ======================================================
# STEP 3 — MODIFY backend/routes/email-agent.mjs
# INSERT AFTER LINE 154
# BEFORE processedThreads.push(…)
# ======================================================

**IMPORTANT**: The file already has these imports at the top (lines 6-9):
- `import { logger } from '../lib/simpleLogger.mjs';` ✅ Already exists
- `import { supabase } from '../config/supabaseClient.mjs';` ✅ Already exists

**DO NOT add duplicate imports.**

Insert the notification hook **AFTER line 154** (after the draft generation block ends) and **BEFORE line 156** (`processedThreads.push(...)`):

```javascript
        // ======================================================
        // Email Agent → Notifications Hook (additive)
        // ======================================================
        try {
          const importantTypes = ['support', 'billing', 'bug_report', 'partnership'];

          if (userId && importantTypes.includes(classification)) {
            // ✅ FIXED: Use actual email object properties
            const emailSubject = email.subject || 'No subject';
            const emailPreview = email.body_text?.substring(0, 200) || email.snippet || emailSubject;
            const gmailMessageId = email.messageId || email.id;

            const titleMap = {
              support: 'New support message',
              billing: 'New billing-related email',
              bug_report: 'New bug report from a customer',
              partnership: 'New partnership inquiry',
            };

            const title = titleMap[classification] ?? 'New important email';
            const body = emailPreview;

            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: userId,
                title,
                body,
                type: `email_agent.${classification}`,
                metadata: {
                  subject: emailSubject,
                  classification,
                  gmail_id: gmailMessageId,
                  thread_id: thread?.id, // thread is available in this scope
                },
              });

            if (notifError) {
              logger.error('[EmailAgent] Failed to create notification:', notifError);
            } else {
              logger.debug('[EmailAgent] Created notification for important email', {
                userId,
                classification,
                subject: emailSubject,
              });
            }
          }
        } catch (hookErr) {
          logger.error('[EmailAgent] Notification hook error:', hookErr);
          // Don't break email processing if notification fails
        }
```

---

# ======================================================
# FINISH: REMIND THE USER TO COMMIT + TAG
# ======================================================

Tell the engineer:

**Next steps:**

1. **Run the migration** in Supabase Dashboard:
   - Copy SQL from `supabase/migrations/20251202_agents_memory_notifications.sql`
   - Run in Supabase SQL Editor
   - Verify tables created successfully

2. **Test locally**:
   - Start backend: `node backend/server.mjs`
   - Test routes: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/notifications`
   - Verify no errors in logs

3. **Commit + Tag**:
   ```bash
   git add supabase/migrations/20251202_agents_memory_notifications.sql
   git add backend/server.mjs
   git add backend/routes/email-agent.mjs
   git commit -m "feat: Agents backend (memory + notifications + business chat)"
   git tag agents-backend-v1
   ```

4. **Deploy**:
   - Push to main branch
   - Verify migration runs in production Supabase
   - Monitor logs for any errors

---

# ✅ **CORRECTED VERSION COMPLETE**

**All fixes applied:**
- ✅ Import path fixed (`./config` not `../config`)
- ✅ Email agent variables fixed (use `email.subject`, `email.body_text`, `email.messageId`)
- ✅ Model name fixed (`claude-sonnet-4-5-20250929` - matches codebase)
- ✅ Supabase import pattern matches codebase (dynamic imports in routes)
- ✅ All variables mapped correctly from email object

**Ready to paste into Cursor.**

