#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Atlas mobile reset with correct Node & Expo/Metro alignment"

# 0) Ensure we're at repo root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# 1) Recommend Node 20 LTS (Expo doesn't support Node 22 yet)
NODE_OK=0
NODE_VER_RAW="$(node -v || true)"
if [[ "$NODE_VER_RAW" =~ ^v(18|20)\. ]]; then
  NODE_OK=1
fi

if [ $NODE_OK -eq 0 ]; then
  echo "⚠️ Detected Node $NODE_VER_RAW. Expo works best with Node 18/20 (LTS)."
  if command -v nvm >/dev/null 2>&1; then
    echo "→ Using nvm to switch to Node 20 LTS locally"
    # shellcheck disable=SC1090
    source ~/.nvm/nvm.sh
    nvm install --lts=Hydrogen >/dev/null 2>&1 || nvm install 20
    nvm use --lts=Hydrogen >/dev/null 2>&1 || nvm use 20
    echo "✅ Now using $(node -v)"
  else
    echo "👉 If you can, switch to Node 20 (nvm/asdf). I'll continue, but Expo may still break on Node 22."
  fi
fi

# 2) Stop any running Expo/Metro processes
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "metro" >/dev/null 2>&1 || true

# 3) Remove ALL Metro overrides/hacks we may have tried
#    - Root and atlas-mobile package.json: remove "overrides" and Metro pins
#    - Delete custom metro/private symlinks or custom files if present
node -e '
const fs=require("fs");
for (const p of ["package.json","atlas-mobile/package.json"]) {
  if (!fs.existsSync(p)) continue;
  const j=JSON.parse(fs.readFileSync(p,"utf8"));
  if (j.overrides) { delete j.overrides; }
  if (j.resolutions) { delete j.resolutions; }
  const deps=["metro","metro-config","metro-core","metro-cache","metro-transform-worker"];
  for (const d of deps) {
    if (j.dependencies && j.dependencies[d]) delete j.dependencies[d];
    if (j.devDependencies && j.devDependencies[d]) delete j.devDependencies[d];
  }
  fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
  console.log("🧹 cleaned", p);
}'

# 4) Clean installs: root then atlas-mobile (avoid hoist conflicts)
rm -rf node_modules package-lock.json
npm install

cd atlas-mobile
rm -rf node_modules package-lock.json .expo .cache
npm install

# 5) Quick sanity checks
npx expo --version || true
node -e 'try{require("expo/metro-config");console.log("✅ expo/metro-config OK")}catch(e){console.error("❌ expo/metro-config missing:",e.message);process.exit(1)}'

# 6) Start servers the safe way (two terminals recommended)
cd "$REPO_ROOT"
echo
echo "✅ Clean setup done."
echo "Next steps:"
echo "  1) Web:    npm run dev:web"
echo "  2) Mobile: npm run dev:mobile   (starts in atlas-mobile via your safe wrapper)"
echo
