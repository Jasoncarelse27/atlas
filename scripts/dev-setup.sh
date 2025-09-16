#!/usr/bin/env bash
set -euo pipefail

echo "⚙️ Setting up Atlas dev environment..."

# 1. Ensure husky hooks path is correct
git config core.hooksPath .husky

# 2. Create fix-husky.sh (removes deprecated lines)
mkdir -p scripts
cat > scripts/fix-husky.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

FILE=".husky/pre-push"

if [ -f "$FILE" ]; then
  # Remove deprecated lines if they exist
  grep -vE 'husky.sh' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
fi
EOF
chmod +x scripts/fix-husky.sh
echo "✅ Created scripts/fix-husky.sh"

# 3. Add lightweight pre-push check
cat > scripts/prepush.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Running lightweight pre-push checks..."

npm run lint
npm run typecheck

echo "✅ Pre-push checks passed!"
EOF
chmod +x scripts/prepush.sh
echo "✅ Created scripts/prepush.sh"

# 4. Ensure Husky pre-push hook exists and calls prepush.sh
mkdir -p .husky
cat > .husky/pre-push <<'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

bash scripts/prepush.sh
EOF
chmod +x .husky/pre-push
echo "✅ Wired Husky pre-push hook to scripts/prepush.sh"

# 5. Ensure package.json runs fix-husky after install
if ! grep -q "scripts.*postinstall" package.json; then
  npx json -I -f package.json -e \
    'this.scripts = this.scripts || {}; this.scripts.postinstall = "bash scripts/fix-husky.sh || true"'
  echo "✅ Added postinstall hook to package.json"
else
  echo "ℹ️ postinstall hook already exists in package.json"
fi

echo "🎉 Atlas dev setup complete! Husky fixed, pre-push checks in place."
