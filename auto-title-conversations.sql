-- 🧠 Auto-Title Conversations SQL Script
-- Safe, idempotent script to rename "Default Conversation" titles
-- Based on first user message content

UPDATE conversations
SET title = LEFT(
  COALESCE(
    (
      SELECT m.content
      FROM messages m
      WHERE m.conversation_id = conversations.id
        AND m.role = 'user'
      ORDER BY m.created_at ASC
      LIMIT 1
    ),
    title
  ),
  60
)
WHERE title IN ('Default Conversation', 'Untitled', 'New Conversation');

-- Optional: Check results
-- SELECT id, title, created_at FROM conversations WHERE title != 'Default Conversation' ORDER BY created_at DESC LIMIT 10;
