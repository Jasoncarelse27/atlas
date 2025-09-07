#!/usr/bin/env bash
set -euo pipefail

cd atlas-mobile

# 1) Pin Metro to ~0.83.x (needed for ModuleGraph plugin)
npm install metro@0.83.1 metro-config@0.83.1 metro-core@0.83.1 --save-exact

# 2) Patch Expo CLI to use metro-core TerminalReporter
PATCH_DIR="patches/@expo__cli+0.24.21"
mkdir -p "$PATCH_DIR"
cat > "$PATCH_DIR+metro-core.patch" <<'PATCH'
diff --git a/build/src/start/server/metro/TerminalReporter.js b/build/src/start/server/metro/TerminalReporter.js
-const { TerminalReporter } = require("metro/src/lib/TerminalReporter");
+const { TerminalReporter } = require("metro-core");
PATCH

# 3) Enable patch-package
npm install patch-package postinstall-postinstall --save-dev
npx patch-package @expo/cli

# 4) Clear caches
rm -rf .expo .cache node_modules/.cache
npm install