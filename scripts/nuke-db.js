// scripts/nuke-db.js
// Hard-reset IndexedDB for Atlas (http://localhost:5174)

import fs from "fs"
import os from "os"
import path from "path"

const BROWSERS = {
  chrome: "~/Library/Application Support/Google/Chrome/Default/IndexedDB",
  canary: "~/Library/Application Support/Google/Chrome Canary/Default/IndexedDB",
  brave: "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/IndexedDB",
  edge: "~/Library/Application Support/Microsoft Edge/Default/IndexedDB",
  arc: "~/Library/Application Support/Arc/User Data/Default/IndexedDB"
}

const ORIGIN = "http_localhost_5174" // IndexedDB folder for http://localhost:5174

function expandHome(p) {
  return p.replace("~", os.homedir())
}

function nukeDB() {
  let nuked = false

  for (const [browser, basePath] of Object.entries(BROWSERS)) {
    const fullPath = path.join(expandHome(basePath), ORIGIN)

    if (fs.existsSync(fullPath)) {
      console.log(`🧨 Found IndexedDB for ${browser}: ${fullPath}`)
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`✅ Nuked IndexedDB for ${browser}`)
      nuked = true
    }
  }

  if (!nuked) {
    console.warn("⚠️ No IndexedDB found for http://localhost:5174 in any browser profile")
  } else {
    console.log("🚀 All detected DBs nuked. Restart your dev server with: npm run dev")
  }
}

nukeDB()
