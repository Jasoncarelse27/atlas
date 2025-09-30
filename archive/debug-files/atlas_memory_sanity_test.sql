-- 🧪 Atlas Memory Sanity Test Suite
-- Run this in Supabase SQL Editor to verify Atlas memory system is working

-- 1. Check conversations exist and are properly linked to users
SELECT 
  id, 
  user_id, 
  title, 
  created_at, 
  updated_at
FROM conversations
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check messages are stored and linked properly
SELECT 
  m.id, 
  m.conversation_id, 
  m.role, 
  LEFT(m.content, 80) AS preview, 
  m.created_at
FROM messages m
ORDER BY created_at DESC
LIMIT 10;

-- 3. Ensure assistant + user messages exist in the same conversation
SELECT 
  c.id AS conversation_id, 
  c.title,
  COUNT(*) AS total_messages,
  SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS user_msgs,
  SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) AS assistant_msgs
FROM conversations c
JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, c.title
ORDER BY total_messages DESC
LIMIT 5;

-- 4. Validate row-level security (RLS) is working
-- This should return 0 rows when run as authenticated user (not service_role)
-- because users can only see their own conversations
SELECT COUNT(*) AS unauthorized_conversations
FROM conversations 
WHERE user_id != auth.uid();

-- 5. Check recent conversation activity (last 24 hours)
SELECT 
  c.title,
  c.created_at,
  COUNT(m.id) AS message_count,
  MAX(m.created_at) AS last_message_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.title, c.created_at
ORDER BY c.created_at DESC;

-- 6. Verify message roles and content structure
SELECT 
  role,
  COUNT(*) AS count,
  AVG(LENGTH(content)) AS avg_content_length
FROM messages
GROUP BY role
ORDER BY count DESC;

-- 7. Check for orphaned messages (messages without conversations)
SELECT COUNT(*) AS orphaned_messages
FROM messages m
LEFT JOIN conversations c ON c.id = m.conversation_id
WHERE c.id IS NULL;

-- 8. Verify conversation titles are being set properly
SELECT 
  title,
  COUNT(*) AS conversation_count
FROM conversations
GROUP BY title
ORDER BY conversation_count DESC
LIMIT 10;

