#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="atlas-mobile"  # change if your mobile folder has a different name

# 0) cd to repo root
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"

[ -d "$MOBILE_DIR" ] || { echo "❌ Mobile dir '$MOBILE_DIR' not found. Update MOBILE_DIR and rerun."; exit 1; }
cd "$MOBILE_DIR"

echo "🔎 Looking for TerminalReporter imports…"
grep -RIn --line-number "TerminalReporter" . || true

# 1) Ensure metro config exists (Expo default, no custom reporter)
METRO_FILE=""
for f in metro.config.ts metro.config.js metro.config.cjs metro.config.mjs; do
  [ -f "$f" ] && METRO_FILE="$f" && break
done

if [ -z "$METRO_FILE" ]; then
  echo "🆕 Creating clean metro.config.js"
  cat > metro.config.js <<'JS'
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config; // no custom reporter
JS
  METRO_FILE="metro.config.js"
fi

# 2) Patch any internal TerminalReporter import to the public API
if grep -q "metro/src/lib/TerminalReporter" "$METRO_FILE"; then
  cp -f "$METRO_FILE" "${METRO_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
  node - <<'NODE'
const fs=require('fs');
const files=['metro.config.ts','metro.config.js','metro.config.cjs','metro.config.mjs'].filter(f=>fs.existsSync(f));
const file=files[0];
let s=fs.readFileSync(file,'utf8');

s=s
  // CommonJS: const TerminalReporter = require('metro/src/lib/TerminalReporter');
  .replace(
    /(const|var|let)\s+TerminalReporter\s*=\s*require\(['"]metro\/src\/lib\/TerminalReporter['"]\);?/g,
    "const { TerminalReporter } = require('metro-core');"
  )
  // ESM: import TerminalReporter from 'metro/src/lib/TerminalReporter'
  .replace(
    /import\s+TerminalReporter\s+from\s+['"]metro\/src\/lib\/TerminalReporter['"];?/g,
    "import { TerminalReporter } from 'metro-core';"
  );

fs.writeFileSync(file,s,'utf8');
console.log(`✅ Patched ${file} → use { TerminalReporter } from 'metro-core'`);
NODE
else
  echo "ℹ️ No internal TerminalReporter import found in $METRO_FILE (good)."
fi

# 3) Optional: if your config *sets* a reporter, keep it working with metro-core
# (no-op if you don't use a custom reporter)

# 4) Clean caches (stale Metro state can re-trigger the error)
echo "🧹 Clearing caches…"
rm -rf .expo .cache node_modules/.cache || true

# 5) Ensure expo is available here, then start from the correct folder
npx --yes expo --version >/dev/null 2>&1 || npm install expo --save

echo "📱 Starting Expo (mobile) from $(pwd)…"
npx expo start --clear
