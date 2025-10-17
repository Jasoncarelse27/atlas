#!/bin/bash
# One-command Atlas setup

echo "🚀 Atlas Quick Setup..."

# Add aliases
cat >> ~/.zshrc << 'EOF'

# Atlas Aliases
alias atlas="cd /Users/jasoncarelse/.cursor/worktrees/atlas/1760695834788-3f5bbf"
alias atlas-dev="atlas && npm run start:dev"
alias atlas-health="atlas && npm run typecheck && npm run build"
EOF

echo "✅ Done! Run: source ~/.zshrc"

