import { v4 as uuidv4 } from "uuid";
import { atlasDB } from "../database/atlasDB";
import { supabase } from "../lib/supabaseClient";

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;
const DEFAULT_CONVERSATION_KEY = "atlas-default-conversation";

export async function runDbMigrations(userId?: string) {
  console.log("[DB MIGRATION] Starting database migration...");

  try {
    // ✅ Use new Golden Standard Dexie schema
    await atlasDB.open();
    console.log("[DB MIGRATION] Using new Golden Standard Dexie schema ✅");

    console.log("[DB MIGRATION] Database schema is healthy ✅");
  } catch (err) {
    console.error("[DB MIGRATION] Error:", err);
    // ✅ Don't crash app
    return [];
  }

  // 1. Clear invalid messages (only if table exists)
  if (atlasDB.messages) {
    const allMessages = await atlasDB.messages.toArray();
    const invalidMessages = allMessages.filter(
      (m) => !m.conversationId || !UUID_REGEX.test(m.conversationId)
    );

    if (invalidMessages.length > 0) {
      console.warn(
        `[DB MIGRATION] Found ${invalidMessages.length} invalid messages → clearing`
      );
      await atlasDB.messages.bulkDelete(invalidMessages.map((m) => m.id));
    }
  } else {
    console.log("[DB MIGRATION] messages table not found, skipping");
  }

  // 2. Clear invalid conversations (only if table exists)
  if (atlasDB.conversations) {
    const allConversations = await atlasDB.conversations.toArray();
    const invalidConversations = allConversations.filter(
      (c) => !c.id || !UUID_REGEX.test(c.id)
    );

    if (invalidConversations.length > 0) {
      console.warn(
        `[DB MIGRATION] Found ${invalidConversations.length} invalid conversations → clearing`
      );
      await atlasDB.conversations.bulkDelete(invalidConversations.map((c) => c.id));
    }
  } else {
    console.log("[DB MIGRATION] conversations table not found, skipping");
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
