-- Fix Conversation Titles - Professional Auto-Generation
-- This migration updates all unprofessional conversation titles

-- 1. Update conversations with generic/unprofessional titles
UPDATE conversations
SET title = CASE 
  -- For conversations with actual user messages, use first user message
  WHEN EXISTS (
    SELECT 1 FROM messages m 
    WHERE m.conversation_id = conversations.id 
    AND m.role = 'user' 
    AND m.content IS NOT NULL 
    AND LENGTH(TRIM(m.content)) > 0
  ) THEN LEFT(
    COALESCE(
      (
        SELECT TRIM(m.content)
        FROM messages m
        WHERE m.conversation_id = conversations.id
          AND m.role = 'user'
          AND m.content IS NOT NULL
          AND LENGTH(TRIM(m.content)) > 0
        ORDER BY m.created_at ASC
        LIMIT 1
      ),
      'Chat ' || EXTRACT(EPOCH FROM created_at)::bigint
    ),
    50
  )
  -- For conversations without messages, use timestamp-based name
  ELSE 'Chat ' || EXTRACT(EPOCH FROM created_at)::bigint
END
WHERE title IN (
  'Default Conversation', 
  'New Conversation', 
  'Untitled', 
  'New conversation',
  'Here are a few options for...',
  'Here are some options:',
  'Here are some options: 1...',
  'Here are some options for...',
  'Here are a few options:',
  'Here are a few options: 1...'
) OR title LIKE 'Here are %' 
OR title LIKE 'Here is %'
OR title LIKE 'Here%options%'
OR LENGTH(title) > 60;

-- 2. Clean up any remaining problematic titles
UPDATE conversations
SET title = 'Chat ' || EXTRACT(EPOCH FROM created_at)::bigint
WHERE title IS NULL 
OR title = '' 
OR title = ' '
OR title LIKE '%...%'
OR title LIKE '%options%'
OR LENGTH(title) > 60;

-- 3. Add a function for future title generation
CREATE OR REPLACE FUNCTION generate_conversation_title(conversation_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  first_message TEXT;
  clean_title TEXT;
BEGIN
  -- Get first user message
  SELECT content INTO first_message
  FROM messages 
  WHERE conversation_id = conversation_uuid 
    AND role = 'user' 
    AND content IS NOT NULL 
    AND LENGTH(TRIM(content)) > 0
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF first_message IS NULL THEN
    RETURN 'Chat ' || EXTRACT(EPOCH FROM NOW())::bigint;
  END IF;
  
  -- Clean the title (remove common prefixes, limit length)
  clean_title := TRIM(first_message);
  
  -- Remove common AI response prefixes
  clean_title := REGEXP_REPLACE(clean_title, '^(Here are|Here is|Here\'s|Here we|Let me|I can|I\'ll|I will)', '', 'gi');
  clean_title := REGEXP_REPLACE(clean_title, '^(some|a few|several|many|various)', '', 'gi');
  clean_title := REGEXP_REPLACE(clean_title, '^(options?|ways?|things?|ideas?|suggestions?)', '', 'gi');
  clean_title := TRIM(clean_title);
  
  -- If nothing left, use original
  IF LENGTH(clean_title) = 0 THEN
    clean_title := first_message;
  END IF;
  
  -- Limit to 50 characters and find good break point
  IF LENGTH(clean_title) > 50 THEN
    -- Try to find a good break point
    IF POSITION(' ' IN SUBSTRING(clean_title, 1, 50)) > 0 THEN
      clean_title := SUBSTRING(clean_title, 1, POSITION(' ' IN SUBSTRING(clean_title, 1, 50)) - 1);
    ELSE
      clean_title := SUBSTRING(clean_title, 1, 47) || '...';
    END IF;
  END IF;
  
  RETURN clean_title;
END;
$$;

-- 4. Apply the function to any remaining problematic titles
UPDATE conversations
SET title = generate_conversation_title(id)
WHERE title LIKE 'Here are%' 
OR title LIKE 'Here is%' 
OR title LIKE 'Here%options%'
OR title LIKE '%...%'
OR LENGTH(title) > 60;

-- 5. Success message
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM conversations 
  WHERE title NOT LIKE 'Here are%' 
  AND title NOT LIKE 'Here is%' 
  AND title NOT LIKE 'Here%options%'
  AND title NOT LIKE '%...%'
  AND LENGTH(title) <= 60;
  
  RAISE NOTICE '✅ Conversation titles fixed! % conversations now have professional titles', updated_count;
END$$;
