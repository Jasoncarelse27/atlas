import { Cloud, CloudOff, RefreshCw } from "lucide-react"
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
  let icon = <CloudOff size={14} />
  
  if (isSyncingNow) { 
    text = "Syncing…"; 
    color = "text-atlas-sage"
    icon = <RefreshCw size={14} className="animate-spin" />
  }
  else if (isOnline) { 
    text = `Synced ${timeAgo}`; 
    color = "text-emerald-400"
    icon = <Cloud size={14} />
  }

  return (
    <div className="flex items-center justify-center gap-1 text-xs mt-1 transition-all duration-200">
      {icon}
      <span className={color}>{text}</span>
    </div>
  )
}