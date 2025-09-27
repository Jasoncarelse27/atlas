import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { supabase } from "../lib/supabaseClient";
import { immediateReset } from "../utils/immediateReset";

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;
const DEFAULT_CONVERSATION_KEY = "atlas-default-conversation";

export async function runDbMigrations(userId?: string) {
  console.log("[DB MIGRATION] Starting database migration...");

  // Force clear and rebuild database if schema issues persist
  try {
    // Test the specific query that's failing
    await db.messages.where('sync_status').equals('pending').limit(1).toArray();
    console.log("[DB MIGRATION] Database schema is healthy");
  } catch (error) {
    console.warn("[DB MIGRATION] Schema error detected:", error);
    if (error instanceof Error && (error.message.includes('sync_status') || error.message.includes('not indexed') || error.message.includes('SchemaError'))) {
      console.warn("[DB MIGRATION] Schema error detected, forcing schema update...");
      await immediateReset();
      return;
    }
    throw error;
  }

  // 1. Clear invalid messages
  const allMessages = await db.messages.toArray();
  const invalidMessages = allMessages.filter(
    (m) => !m.conversation_id || !UUID_REGEX.test(m.conversation_id)
  );

  if (invalidMessages.length > 0) {
    console.warn(
      `[DB MIGRATION] Found ${invalidMessages.length} invalid messages → clearing`
    );
    await db.messages.bulkDelete(invalidMessages.map((m) => m.id));
  }

  // 2. Clear invalid conversations
  const allConversations = await db.conversations.toArray();
  const invalidConversations = allConversations.filter(
    (c) => !c.id || !UUID_REGEX.test(c.id)
  );

  if (invalidConversations.length > 0) {
    console.warn(
      `[DB MIGRATION] Found ${invalidConversations.length} invalid conversations → clearing`
    );
    await db.conversations.bulkDelete(invalidConversations.map((c) => c.id));
  }

  // 3. Remove old localStorage key
  if (localStorage.getItem("atlas-default-conversation")) {
    console.warn("[DB MIGRATION] Removing legacy default-conversation key");
    localStorage.removeItem("atlas-default-conversation");
  }

  // 4. Ensure a valid default conversation exists
  if (userId) {
    let conversationId = localStorage.getItem(DEFAULT_CONVERSATION_KEY);

    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      conversationId = uuidv4();
      localStorage.setItem(DEFAULT_CONVERSATION_KEY, conversationId);

      console.log(
        `[DB MIGRATION] Creating fresh default conversation for user ${userId}`
      );

      const { error } = await supabase.from("conversations").insert({
        id: conversationId,
        user_id: userId,
        title: "Default Conversation",
      });

      if (error) {
        console.error("[DB MIGRATION] Failed to create conversation:", error);
      } else {
        console.log("[DB MIGRATION] Default conversation created ✅", conversationId);
      }
    }
  }

  console.log("[DB MIGRATION] Completed successfully ✅");
}
