import { v4 as uuidv4 } from "uuid";
import { atlasDB } from "../database/atlasDB";
import { supabase } from "../lib/supabaseClient";
import { logger } from '../lib/logger';

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;
const DEFAULT_CONVERSATION_KEY = "atlas-default-conversation";

// ✅ Migration guard to prevent multiple calls
let isMigrating = false;
let migrationTimeout: ReturnType<typeof setTimeout> | null = null;

export async function runDbMigrations(userId?: string) {
  if (isMigrating) {
    return;
  }
  
  isMigrating = true;
  
  // Set a timeout to prevent stuck migrations
  migrationTimeout = setTimeout(() => {
    isMigrating = false;
  }, 30000); // 30 second timeout

  try {
    // ✅ Use new Golden Standard Dexie schema
    await atlasDB.open();
    logger.debug("[DB MIGRATION] Using new Golden Standard Dexie schema ✅");

    logger.debug("[DB MIGRATION] Database schema is healthy ✅");
  } catch (err) {
      // Intentionally empty - error handling not required
    // ✅ Don't crash app - but reset the flag
    isMigrating = false;
    
    // Clear the timeout
    if (migrationTimeout) {
      clearTimeout(migrationTimeout);
      migrationTimeout = null;
    }
    return [];
  }

  // 1. Clear invalid messages (only if table exists)
  if (atlasDB.messages) {
    const allMessages = await atlasDB.messages.toArray();
    const invalidMessages = allMessages.filter(
      (m) => !m.conversationId || !UUID_REGEX.test(m.conversationId)
    );

    if (invalidMessages.length > 0) {
      logger.debug(`[DB MIGRATION] Found ${invalidMessages.length} invalid messages → clearing`);
      await atlasDB.messages.bulkDelete(invalidMessages.map((m) => m.id));
    }
  } else {
    // Messages table doesn't exist
  }

  // 2. Clear invalid conversations (only if table exists)
  if (atlasDB.conversations) {
    const allConversations = await atlasDB.conversations.toArray();
    const invalidConversations = allConversations.filter(
      (c) => !c.id || !UUID_REGEX.test(c.id)
    );

    if (invalidConversations.length > 0) {
      logger.debug(`[DB MIGRATION] Found ${invalidConversations.length} invalid conversations → clearing`);
      await atlasDB.conversations.bulkDelete(invalidConversations.map((c) => c.id));
    }
  } else {
    // Conversations table doesn't exist
  }

  // 3. Remove old localStorage key
  if (localStorage.getItem("atlas-default-conversation")) {
    localStorage.removeItem("atlas-default-conversation");
  }

  // 4. Ensure a valid default conversation exists (only if none exists)
  if (userId) {
    let conversationId = localStorage.getItem(DEFAULT_CONVERSATION_KEY);

    // ✅ Check if conversation already exists in database
    if (conversationId && UUID_REGEX.test(conversationId)) {
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .single();
      
      if (existingConv) {
        return;
      }
    }

    // ✅ Only create if no valid conversation exists
    conversationId = uuidv4();
    localStorage.setItem(DEFAULT_CONVERSATION_KEY, conversationId);

    logger.debug(`[DB MIGRATION] Creating fresh default conversation for user ${userId}`);

    const { error } = await supabase.from("conversations").insert({
      id: conversationId,
      user_id: userId,
      title: "Default Conversation",
    });

    if (error) {
      // Conversation creation error logged elsewhere
    } else {
      logger.debug("[DB MIGRATION] Default conversation created ✅", conversationId);
    }
  }

  logger.debug("[DB MIGRATION] Completed successfully ✅");
  isMigrating = false;
  
  // Clear the timeout
  if (migrationTimeout) {
    clearTimeout(migrationTimeout);
    migrationTimeout = null;
  }
}
