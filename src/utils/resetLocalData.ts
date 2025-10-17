import { toast } from "sonner"
import { logger } from '../lib/logger';

export async function resetLocalData() {
  logger.warn("🚨 Resetting local data (IndexedDB + localStorage)…")

  // Show toast immediately
  toast("Atlas data reset", {
    description: "All local data will be cleared and the app will reload.",
    duration: 3000,
  })

  // Clear all IndexedDB
  if ("databases" in indexedDB) {
    const dbs = await (indexedDB as any).databases()
    for (const db of dbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name)
      }
    }
  } else {
    // IndexedDB not available
  }

  // Clear localStorage + sessionStorage
  localStorage.clear()
  sessionStorage.clear()

  logger.debug("✅ Local data reset complete — reloading…")
  setTimeout(() => {
    window.location.reload()
  }, 500) // tiny delay so toast shows
}

// 🔗 Attach to window for manual use in DevTools
;(window as any).atlasReset = resetLocalData
