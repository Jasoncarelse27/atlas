#!/usr/bin/env bash
set -euo pipefail

# --- paths (adjust if yours differ) ---
MOBILE_DIR="atlas-mobile"   # Expo app folder
WEB_DIR="."                 # Vite web app lives at repo root

# --- helpers ---
log()   { printf "\n\033[1m%s\033[0m\n" "$*"; }
ok()    { printf "✅ %s\n" "$*"; }
warn()  { printf "⚠️  %s\n" "$*"; }
die()   { printf "❌ %s\n" "$*" ; exit 1; }

ensure_node() {
  command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 20/22 and retry."
  command -v npm  >/dev/null 2>&1 || die "npm not found. Install Node/npm and retry."
}

ensure_deps() {
  local dir="$1"
  if [ ! -d "$dir" ]; then die "Directory not found: $dir"; fi
  pushd "$dir" >/dev/null
  if [ ! -d node_modules ]; then
    log "📥 Installing dependencies in $dir ..."
    (npm ci || npm install)
  else
    ok "node_modules present in $dir (skipping install)"
  fi
  popd >/dev/null
}

run_mobile_dev() {
  ensure_deps "$MOBILE_DIR"
  pushd "$MOBILE_DIR" >/dev/null
  log "🚀 Starting Expo (mobile) dev server..."
  # Expo dev server script should exist in package.json (e.g. "dev": "expo start --clear")
  npm run dev
  popd >/dev/null
}

run_web_dev() {
  ensure_deps "$WEB_DIR"
  pushd "$WEB_DIR" >/dev/null
  log "🌐 Starting Vite (web) dev server..."
  npm run dev
  popd >/dev/null
}

build_mobile() {
  ensure_deps "$MOBILE_DIR"
  pushd "$MOBILE_DIR" >/dev/null
  log "🏗️ Building mobile app..."
  # Typical Expo web build (tsc + vite preview) or EAS placeholder; adapt as needed
  npm run build
  popd >/dev/null
}

build_web() {
  ensure_deps "$WEB_DIR"
  pushd "$WEB_DIR" >/dev/null
  log "🏗️ Building web app..."
  npm run build
  popd >/dev/null
}

run_tests_fast_gate() {
  ensure_deps "$WEB_DIR"
  pushd "$WEB_DIR" >/dev/null
  log "🧪 Fast gate (types + tests + build)..."
  npm run check:types
  npm run check:test
  npm run build
  ok "Fast gate passed"
  popd >/dev/null
}

# --- auto-detect / selection ---
ensure_node

MODE="${1:-auto}"

if [ "$MODE" = "auto" ]; then
  have_mobile="no"; [ -d "$MOBILE_DIR" ] && [ -f "$MOBILE_DIR/package.json" ] && have_mobile="yes"
  have_web="no";    [ -f "$WEB_DIR/package.json" ] && grep -q "\"vite\"" "$WEB_DIR/package.json" && have_web="yes"

  if [ "$have_mobile" = "yes" ] && [ "$have_web" = "no" ]; then
    MODE="mobile"
  elif [ "$have_mobile" = "no" ] && [ "$have_web" = "yes" ]; then
    MODE="web"
  else
    # both exist -> ask nicely
    echo
    log "Choose what to run:"
    PS3="› "
    select choice in "Mobile (Expo dev)" "Web (Vite dev)" "Build both" "Fast gate (types+tests+build)" "Quit"; do
      case "$REPLY" in
        1) MODE="mobile"; break ;;
        2) MODE="web";    break ;;
        3) MODE="build";  break ;;
        4) MODE="fast";   break ;;
        5) exit 0 ;;
        *) echo "Please choose 1-5";;
      esac
    done
  fi
fi

case "$MODE" in
  mobile) run_mobile_dev ;;
  web)    run_web_dev ;;
  build)  build_mobile; build_web; ok "Build complete (mobile + web)" ;;
  fast)   run_tests_fast_gate ;;
  *)
    warn "Unknown mode: $MODE"
    echo "Usage: ./start.sh [auto|mobile|web|build|fast]"
    exit 2
    ;;
esac
