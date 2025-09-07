#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="atlas-mobile"  # change if needed

# 0) repo root → mobile
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"
[ -d "$MOBILE_DIR" ] || { echo "❌ '$MOBILE_DIR' not found"; exit 1; }
cd "$MOBILE_DIR"

# 1) Ensure metro + expo config present
[ -f package.json ] || { echo "❌ no package.json in $(pwd)"; exit 1; }
npm pkg set overrides.metro-core="*" >/dev/null || true  # ensure metro-core present
npm i -D metro-core >/dev/null 2>&1 || true

# 2) Create shim that re-exports TerminalReporter from metro-core
cat > metro-terminal-reporter-shim.js <<'JS'
try {
  const { TerminalReporter } = require('metro-core');
  module.exports = TerminalReporter; // default export shape expected by old imports
} catch (e) {
  throw new Error("metro-core not found; install it with: npm i -D metro-core");
}
JS

# 3) Create/patch metro.config.js to alias the old path to our shim
if [ ! -f metro.config.js ]; then
  cat > metro.config.js <<'JS'
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);

// Alias old internal import → our shim
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  'metro/src/lib/TerminalReporter': path.resolve(__dirname, 'metro-terminal-reporter-shim.js'),
});

module.exports = config;
JS
else
  node - <<'NODE'
const fs=require('fs'), path=require('path');
const p='metro.config.js';
let s=fs.readFileSync(p,'utf8');
if(!/metro-terminal-reporter-shim/.test(s)){
  if(/module\.exports\s*=/.test(s)){
    s = s.replace(/module\.exports\s*=\s*config\s*;?/,
`const path = require('path');
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  'metro/src/lib/TerminalReporter': path.resolve(__dirname, 'metro-terminal-reporter-shim.js'),
});
module.exports = config;`);
  } else {
    // naive append
    s += `

const path = require('path');
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  'metro/src/lib/TerminalReporter': path.resolve(__dirname, 'metro-terminal-reporter-shim.js'),
});
module.exports = config;
`;
  }
  fs.writeFileSync(p,s,'utf8');
  console.log('✅ Patched metro.config.js with alias → shim');
} else {
  console.log('ℹ️ metro.config.js already aliases the shim');
}
NODE
fi

# 4) Clear caches & start Expo from the correct directory
rm -rf .expo .cache node_modules/.cache || true
echo "📱 Starting Expo (mobile)…"
npx expo start --clear
