import { toast } from 'sonner';
import { logger } from '../lib/logger';
// ✅ FIXED: Use new Golden Standard database name
const DB_NAME = 'AtlasDB';

let resetAttempts = 0;

export async function handleDexieError(error: any) {
  // ✅ Auto-reset enabled with safety checks
  if ((error?.name === "SchemaError" || error?.name === "UpgradeError" || error?.name === "VersionError") && resetAttempts < 1) {
    if (localStorage.getItem("dexie_reset") === "1") {
      logger.error("🚨 Dexie reset already attempted — manual fix required.")
      toast.error("Atlas reset failed", {
        description: "Schema error persists. Run indexedDB.deleteDatabase('AtlasDB') manually.",
        duration: 4000,
      })
      return
    }

    logger.warn("🚨 Dexie schema error detected:", error)
    resetAttempts++
    localStorage.setItem("dexie_reset", "1")

    // ✅ Show toast before deletion
    toast("Atlas reset in progress", {
      description: "Clearing old data and reloading app…",
      duration: 3000,
    })

    const deleteReq = indexedDB.deleteDatabase(DB_NAME)

    deleteReq.onsuccess = () => {
      logger.debug("✅ Dexie DB deleted, reloading…")
      toast.success("Atlas reset complete", {
        description: "App will reload with a fresh database.",
        duration: 2000,
      })
      setTimeout(() => {
        localStorage.removeItem("dexie_reset") // Clear flag on success
        window.location.reload()
      }, 500)
    }

    deleteReq.onerror = (e) => {
      toast.error("Atlas reset failed", {
        description: "Could not delete database. Try indexedDB.deleteDatabase('AtlasDB').",
      })
    }

    deleteReq.onblocked = () => {
      toast("Reset blocked", {
        description: "Please close other Atlas tabs and retry.",
      })
    }
  } else {
    // Not a blocking error
  }
}

// ESM export handled above
