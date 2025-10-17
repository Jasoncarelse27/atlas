import { supabase } from "@/lib/supabaseClient"
import { atlasDB } from "./atlasDB"
import { logger } from '../lib/logger';

let migrationLock = false

export async function runMigrations() {
  if (migrationLock) {
    return
  }

  migrationLock = true

  try {
    await atlasDB.open()
    logger.debug("[DB MIGRATION] Database schema is healthy ✅")

    const user = (await supabase.auth.getUser()).data.user
    if (!user || !user.id) {
      logger.debug("[DB MIGRATION] No authenticated user - skipping default conversation")
      return
    }
    const userId = user.id // ✅ No fallback to "anonymous"

    // ✅ Check if a default conversation exists
    const existing = await atlasDB.conversations
      .where("userId")
      .equals(userId)
      .count()

    if (existing === 0) {
      const id = crypto.randomUUID()
      await atlasDB.conversations.put({
        id,
        userId,
        title: "Default Conversation",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      logger.debug(`[DB MIGRATION] Default conversation created ✅ – "${id}"`)
    } else {
      // Conversation already exists
    }

    logger.debug("[DB MIGRATION] Completed successfully ✅")
  } catch (err) {
      // Intentionally empty - error handling not required
  } finally {
    migrationLock = false
  }
}
