#!/usr/bin/env bash
set -euo pipefail

# === config (change if your mobile folder is different) ===
MOBILE_DIR="atlas-mobile"
# =========================================================

# 0) repo root
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"

# 1) ensure scripts dir
mkdir -p scripts

# 2) write reusable fixer script
cat > scripts/fix-metro.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="${MOBILE_DIR:-atlas-mobile}"

if [ ! -d "$MOBILE_DIR" ]; then
  echo "❌ Mobile dir '$MOBILE_DIR' not found. Set MOBILE_DIR env or edit this script."
  exit 1
fi

cd "$MOBILE_DIR"

echo "🔎 Searching for internal TerminalReporter imports…"
grep -RIn --line-number "metro/src/lib/TerminalReporter" . || true

# Ensure a clean Expo metro config exists
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

# Patch project metro config if it references metro internals
if grep -q "metro/src/lib/TerminalReporter" "$METRO_FILE"; then
  cp -f "$METRO_FILE" "${METRO_FILE}.backup.$(date +%Y%m%d%H%M%S)"
  node - <<'NODE'
const fs=require('fs');
const files=['metro.config.ts','metro.config.js','metro.config.cjs','metro.config.mjs'].filter(f=>fs.existsSync(f));
for (const file of files) {
  let s=fs.readFileSync(file,'utf8'); const before=s;
  s=s
    .replace(/(const|var|let)\s+TerminalReporter\s*=\s*require\(['"]metro\/src\/lib\/TerminalReporter['"]\);?/g,"const { TerminalReporter } = require('metro-core');")
    .replace(/import\s+TerminalReporter\s+from\s+['"]metro\/src\/lib\/TerminalReporter['"];?/g,"import { TerminalReporter } from 'metro-core';");
  if (s!==before){ fs.writeFileSync(file,s,'utf8'); console.log('✅ Patched',file); }
}
NODE
else
  echo "ℹ️ Project metro config does not import metro internals — good."
fi

# Patch dependencies if any ship the internal path
echo "📦 Ensuring patch-package is available…"
npm i -D patch-package >/dev/null

echo "🩹 Patching node_modules (if any offenders)…"
# Mac/BSD sed uses -i '' for in-place; fallback to GNU style if present
if sed --version >/dev/null 2>&1; then
  sed -i "s#'metro/src/lib/TerminalReporter'#'metro-core'#g" node_modules/**/metro*.{js,ts} 2>/dev/null || true
  sed -i 's#"metro/src/lib/TerminalReporter"#"metro-core"#g' node_modules/**/metro*.{js,ts} 2>/dev/null || true
else
  sed -i '' "s#'metro/src/lib/TerminalReporter'#'metro-core'#g" node_modules/**/metro*.{js,ts} 2>/dev/null || true
  sed -i '' 's#"metro/src/lib/TerminalReporter"#"metro-core"#g' node_modules/**/metro*.{js,ts} 2>/dev/null || true
fi

# Save patches so they reapply after npm install
npx patch-package || true

echo "🧹 Clearing caches…"
rm -rf .expo .cache node_modules/.cache || true

echo "✅ Metro fixed. To start Expo now, run:"
echo "   cd \"$MOBILE_DIR\" && npx expo start --clear"
BASH

chmod +x scripts/fix-metro.sh

# 3) wire npm scripts (root package.json)
node - <<'NODE'
const fs=require('fs');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.scripts=pkg.scripts||{};
pkg.scripts["metro:fix"]="MOBILE_DIR=atlas-mobile bash scripts/fix-metro.sh";
pkg.scripts["dev:mobile"]="bash -lc 'cd atlas-mobile && npx expo start --clear'";
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));
console.log('✅ Added npm scripts: metro:fix, dev:mobile');
NODE

echo "🎉 Done."
echo "• Fix Metro once (or anytime):  npm run metro:fix"
echo "• Start mobile (correct CWD):   npm run dev:mobile"
