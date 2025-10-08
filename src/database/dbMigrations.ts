import { supabase } from "@/lib/supabaseClient"
import { atlasDB } from "./atlasDB"

let migrationLock = false

export async function runMigrations() {
  if (migrationLock) {
    return
  }

  migrationLock = true

  try {
    await atlasDB.open()
    console.log("[DB MIGRATION] Database schema is healthy ✅")

    const user = (await supabase.auth.getUser()).data.user
    const userId = user?.id || "anonymous"

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
      console.log(`[DB MIGRATION] Default conversation created ✅ – "${id}"`)
    } else {
    }

    console.log("[DB MIGRATION] Completed successfully ✅")
  } catch (err) {
  } finally {
    migrationLock = false
  }
}
