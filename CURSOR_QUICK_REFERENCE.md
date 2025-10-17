# 💎 Cursor Quick Reference - Atlas

## Model Control (One Command)
```bash
/set-model auto                    # 🤖 Balanced (default)
/set-model claude-3-opus          # 🧠 Deep reasoning
/set-model claude-3.5-sonnet      # ⚡ Fast iteration
```

## When to Switch
| Use | For |
|-----|-----|
| 🧠 **Opus** | FastSpring, migrations, security, tier logic |
| ⚡ **Sonnet** | UI fixes, debugging, TypeScript, styling |
| 🤖 **Auto** | Daily work, mixed tasks, unsure |

## Daily Start
```bash
cd /Users/jasoncarelse/.cursor/worktrees/atlas/1760695834788-3f5bbf
git pull origin main
npm install
/set-model auto
```

## Quick Checks
```bash
npm run typecheck     # 0 errors?
npm run build         # Success?
npm test              # All pass?
```

## Cursor Shortcuts
- `Cmd + K` → "Scan" = Quick audit
- `Cmd + K` → "Full Project Scan" = Deep analysis
- `Cmd + Z` = Undo AI changes

## Before Push
```bash
grep -r "console\." src --exclude="logger.ts" | wc -l  # = 0?
git add -A && git commit -m "feat: message" && git push
```

## Emergency Mode
```bash
/set-model claude-3-opus
# + Open ChatGPT for parallel analysis
```

---
**ROI Goal:** First-time fixes, proactive prevention, zero wasted loops  
**Status:** ✅ 100% Clean Implementation  
**Tag:** `atlas-clean-implementation`

