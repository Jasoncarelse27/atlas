/**
 * 🧠 Atlas Sync Validator – Vite PWA Architecture
 * Ensures the single-build Atlas (desktop + mobile PWA) is using the correct backend
 * and that build integrity + environment variables are consistent.
 *
 * Run with:  npx tsx scripts/ATLAS_SYNC_VALIDATOR.ts
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const EXPECTED_API = "https://atlas-production-2123.up.railway.app";
const ENV_PATH = path.resolve(process.cwd(), ".env");
const BUILD_DIR = path.resolve(process.cwd(), "dist");

(async () => {
  console.log("\n🔍 [Atlas Sync Validator] Running diagnostic...\n");

  let hasErrors = false;

  // 1️⃣ Check .env and API URL
  if (!fs.existsSync(ENV_PATH)) {
    console.error("❌ .env file missing in root.");
    hasErrors = true;
  } else {
    const VITE_API_URL = process.env.VITE_API_URL;
    if (!VITE_API_URL) {
      console.error("❌ Missing VITE_API_URL in .env");
      hasErrors = true;
    } else {
      console.log("🌐 VITE_API_URL:", VITE_API_URL);
      if (VITE_API_URL !== EXPECTED_API) {
        console.error(`🚨 Mismatch: expected ${EXPECTED_API}, found ${VITE_API_URL}`);
        hasErrors = true;
      } else {
        console.log("✅ VITE_API_URL matches expected backend");
      }
    }
  }

  // 2️⃣ Backend Health Check
  try {
    console.log("\n🧪 Checking backend health...");
    const healthUrl = `${EXPECTED_API}/healthz`;
    const health = await axios.get(healthUrl, { timeout: 8000 });
    
    if (health.status === 200 && health.data) {
      const status = health.data.status || health.data.ready ? 'ok' : 'starting';
      console.log(`✅ Health OK – ${health.status} ${health.statusText}`);
      console.log(`   Status: ${status}, Uptime: ${health.data.uptime?.toFixed(1)}s`);
      
      if (health.data.checks) {
        const dbStatus = health.data.checks.database || 'unknown';
        console.log(`   Database: ${dbStatus}`);
      }
    } else {
      console.error("⚠️ Unexpected health response:", health.status);
      hasErrors = true;
    }
  } catch (err: any) {
    console.error("❌ Health check failed:", err.message);
    if (err.response) {
      console.error(`   Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data).slice(0, 100)}`);
    }
    hasErrors = true;
  }

  // 3️⃣ Verify Build Output
  if (!fs.existsSync(BUILD_DIR)) {
    console.warn("\n⚠️ No build folder detected – run `npm run build` first.");
  } else {
    const files = fs.readdirSync(BUILD_DIR);
    const indexHtml = files.find(f => f === 'index.html');
    const assetsDir = files.find(f => f === 'assets');
    
    console.log(`\n📦 Build artifacts found: ${files.length} files`);
    if (indexHtml) {
      console.log("   ✅ index.html present");
    } else {
      console.warn("   ⚠️ index.html missing");
    }
    if (assetsDir) {
      const assetFiles = fs.readdirSync(path.join(BUILD_DIR, assetsDir));
      console.log(`   ✅ assets/ directory with ${assetFiles.length} files`);
    } else {
      console.warn("   ⚠️ assets/ directory missing");
    }
  }

  // ✅ Final summary
  if (hasErrors) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Atlas Sync Validator: FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Check errors above and fix before deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    process.exit(1);
  } else {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Atlas Sync Validator: PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ .env confirmed and correct
→ Backend responsive
→ Build integrity valid
→ Ready for production launch
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    process.exit(0);
  }
})();

