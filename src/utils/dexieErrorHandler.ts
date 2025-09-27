

import { toast } from "sonner";
import { DB_NAME } from '../db';

let resetAttempts = 0;

export async function handleDexieError(error: any) {
  if (error?.name === "SchemaError" && resetAttempts < 1) {
    if (localStorage.getItem("dexie_reset") === "1") {
      console.error("🚨 Dexie reset already attempted — manual fix required.")
      toast.error("Atlas reset failed", {
        description: "Schema error persists. Run atlasReset() manually.",
        duration: 4000,
      })
      return
    }

    console.warn("🚨 Dexie schema error detected:", error)
    resetAttempts++
    localStorage.setItem("dexie_reset", "1")

    // ✅ Show toast before deletion
    toast("Atlas reset in progress", {
      description: "Clearing old data and reloading app…",
      duration: 3000,
    })

    const deleteReq = indexedDB.deleteDatabase(DB_NAME)

    deleteReq.onsuccess = () => {
      console.log("✅ Dexie DB deleted, reloading…")
      toast.success("Atlas reset complete", {
        description: "App will reload with a fresh database.",
        duration: 3000,
      })
      setTimeout(() => {
        window.location.reload()
      }, 500)
    }

    deleteReq.onerror = (e) => {
      console.error("❌ Failed to delete DB:", e)
      toast.error("Atlas reset failed", {
        description: "Could not delete database. Try atlasReset().",
      })
    }

    deleteReq.onblocked = () => {
      console.warn("⚠️ DB deletion blocked, waiting… (close other tabs?)")
      toast("Reset blocked", {
        description: "Please close other Atlas tabs and retry.",
      })
    }
  } else {
    console.error("[DexieErrorHandler] Unhandled error:", error)
  }
}
