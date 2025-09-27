import { resetLocalData } from "@/utils/resetLocalData"
import React, { useState } from "react"

export function DebugMenu() {
  const [visible, setVisible] = useState(false)

  const toggleVisible = (e: React.MouseEvent) => {
    // Hold Shift + click 3x to reveal
    if (e.shiftKey) {
      setVisible((v) => !v)
    }
  }

  return (
    <div onClick={toggleVisible} style={{ cursor: "pointer" }}>
      {visible && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
          <h3 className="text-red-600 font-semibold">🛠 Debug Menu</h3>
          <p className="text-sm text-gray-600">
            Support-only: Wipe IndexedDB + localStorage.
          </p>
          <button
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
            onClick={resetLocalData}
          >
            Reset Local Data
          </button>
        </div>
      )}
    </div>
  )
}
