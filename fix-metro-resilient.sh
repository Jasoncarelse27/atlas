#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="atlas-mobile"

# repo root → mobile dir
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"
[ -d "$MOBILE_DIR" ] || { echo "❌ '$MOBILE_DIR' not found"; exit 1; }
cd "$MOBILE_DIR"

# 1) Write a robust shim: try metro-core; otherwise export a minimal class Expo can extend
cat > metro-terminal-reporter-shim.js <<'JS'
let Base;
try {
  // preferred: use metro-core if it actually exports TerminalReporter in this version
  const mc = require('metro-core');
  Base = mc && (mc.TerminalReporter || mc.default || mc['TerminalReporter']) || null;
} catch (_) {
  Base = null;
}

// Fallback: minimal no-op class with the shape Expo expects to extend.
if (!Base) {
  class NoopMetroTerminalReporter {
    constructor() {}
    update() {}
    log() {}
    onBegin() {}
    onFinish() {}
  }
  Base = NoopMetroTerminalReporter;
}

// CommonJS default export for legacy importers
module.exports = Base;
JS

# 2) Ensure/patch metro.config.js to alias internal path → shim
if [ ! -f metro.config.js ]; then
  cat > metro.config.js <<'JS'
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);

// Alias the deprecated internal import to our shim
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
if(!/metro-terminal-reporter-shim\.js/.test(s)){
  if(/module\.exports\s*=\s*config/.test(s)){
    s = s.replace(/module\.exports\s*=\s*config\s*;?/,
`const path = require('path');
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  'metro/src/lib/TerminalReporter': path.resolve(__dirname, 'metro-terminal-reporter-shim.js'),
});
module.exports = config;`);
  } else {
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
  console.log('ℹ️ metro.config.js already exists; alias assumed present');
}
NODE
fi

# 3) Clear caches and start via your safe wrapper
rm -rf .expo .cache node_modules/.cache || true
cd ..
npm run dev:mobile
