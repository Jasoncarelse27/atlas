import { useEffect, useState } from "react"
import { isSyncingNow, lastSyncedAt } from "../services/syncService"

export default function SyncStatus({ isOnline }: { isOnline: boolean }) {
  const [timeAgo, setTimeAgo] = useState("")

  useEffect(() => {
    const update = () => {
      if (!lastSyncedAt) return setTimeAgo("never")
      const diff = Math.floor((Date.now() - lastSyncedAt) / 1000)
      if (diff < 5) setTimeAgo("just now")
      else if (diff < 60) setTimeAgo(`${diff}s ago`)
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`)
      else setTimeAgo(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const i = setInterval(update, 15000)
    return () => clearInterval(i)
  }, [lastSyncedAt])

  let text = "Offline"
  let color = "text-red-400"
  if (isSyncingNow) { text = "Syncing…"; color = "text-blue-400" }
  else if (isOnline) { text = `Synced ${timeAgo}`; color = "text-emerald-400" }

  return (
    <div className="text-xs text-center mt-1 transition-all duration-200">
      <span className={color}>{text}</span>
    </div>
  )
}