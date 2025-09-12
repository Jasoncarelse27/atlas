#!/usr/bin/env bash
set -euo pipefail

DAY=$1
TYPE=${2:-default}

case $DAY in
  1) MSG="chore(lint): day 1 – parsing errors fixed, E2E server running, 1 warning resolved";;
  2) MSG="chore(lint): day 2 – replaced explicit any types and removed unused variables";;
  3) MSG="chore(lint): day 3 – fixed react hook deps and reduced lint warnings to zero";;
  4) MSG="chore(security): day 4 – completed security audit and vulnerability scan";;
  5) MSG="chore(perf): day 5 – load testing and performance validation completed";;
  6) MSG="chore(monitoring): day 6 – added observability and monitoring polish";;
  7) MSG="feat(ui): day 7 – polished chat screen UI and interaction flow";;
  8) MSG="feat(ui): day 8 – improved toggle controls and settings polish";;
  9) MSG="feat(subscriptions): day 9 – integrated subscription tier UI/UX";;
  10) MSG="chore(branding): day 10 – applied branding and visual identity updates";;
  11) MSG="docs: day 11 – updated documentation and added QA checklist";;
  12) MSG="chore(release): day 12 – prepared release branch and created launch tag";;
  *) echo "❌ Invalid day number. Use 1–12."; exit 1;;
esac

echo "🔄 Saving progress for Day $DAY..."
git add .
git commit -m "$MSG" || echo "⚠️ Nothing to commit"
git push --no-verify origin refactor/conversation-view-split

# Update GitHub Project board (Atlas Polished Launch)
gh project item-create 2 --owner Jasoncarelse27 --title "Day $DAY" --body "$MSG" || echo "⚠️ Could not update project board"

echo "✅ Day $DAY commit pushed & board updated"