# 💎 Atlas Cursor Ultra Workflow

**ChatGPT Pro + Cursor Ultra Integration Guide**

## 🎯 Purpose
Maximize development velocity and ROI from your $200/month Ultra investment by intelligently switching between Claude models based on task complexity.

---

## ⚙️ Model Control Commands

### Quick Reference
```bash
# 🤖 Auto Mode (Recommended Default)
/set-model auto

# 🧠 Opus Mode (Deep Reasoning)
/set-model claude-3-opus

# ⚡ Sonnet Mode (Fast Iteration)
/set-model claude-3.5-sonnet
```

---

## 📊 Atlas-Specific Model Selection Matrix

| Atlas Task | Model | Why |
|------------|-------|-----|
| **FastSpring Integration** | 🧠 Opus | Multi-file reasoning, security-critical, revenue protection |
| **Tier System Refactoring** | 🧠 Opus | Complex business logic, affects all users |
| **Database Migrations** | 🧠 Opus | Zero-error tolerance, data integrity critical |
| **Security Audits (RLS/API)** | 🧠 Opus | Production-critical, compliance-sensitive |
| **UI Component Styling** | ⚡ Sonnet | Fast feedback loop, visual iteration |
| **Debug Console Errors** | ⚡ Sonnet | Quick isolated fixes |
| **TypeScript Type Fixes** | ⚡ Sonnet | Straightforward, low risk |
| **Import Organization** | ⚡ Sonnet | Mechanical changes |
| **Daily Feature Work** | 🤖 Auto | Mixed complexity, let Cursor decide |
| **Emergency Production Fix** | 🧠 Opus | Maximum reliability needed |

---

## 🚀 Daily Atlas Development Workflow

### Morning Standup
```bash
# 1. Pull latest from main
cd /Users/jasoncarelse/.cursor/worktrees/atlas/1760695834788-3f5bbf
git fetch --tags && git pull origin main

# 2. Verify environment
npm install
npm run typecheck

# 3. Set appropriate model for today's work
# Check your task list, then:
/set-model auto  # Default for mixed work
# OR
/set-model claude-3-opus  # For architecture/security work
# OR
/set-model claude-3.5-sonnet  # For UI/debugging sessions
```

### Before Major Changes
```bash
# 1. Switch to deep reasoning
/set-model claude-3-opus

# 2. Run comprehensive scan
# In Cursor: Cmd+K → "Full Project Scan"

# 3. Verify with Cece (ChatGPT)
# Open ChatGPT Pro and share the plan

# 4. Execute in Cursor with Opus
# Make changes with full context awareness

# 5. Return to balanced mode
/set-model auto
```

---

## 🔍 Smart Commands & Shortcuts

### Code Analysis
| Action | Shortcut | When to Use |
|--------|----------|-------------|
| Quick file audit | `Cmd + K` → "Scan" | Review current file for issues |
| Full repo scan | `Cmd + K` → "Full Project Scan" | Multi-file analysis needed |
| Context-aware help | `Cmd + K` → Ask question | Need explanation or guidance |
| Revert AI edit | `Cmd + Z` | Undo recent AI changes |

### Project Management
```bash
# Type safety check
npm run typecheck

# Production build verification
npm run build

# Run test suite
npm test

# Safe checkpoint commit
git add -A && git commit -m "chore: safe checkpoint" && git push

# Generate Supabase types (when schema changes)
npx supabase gen types typescript --project-id YOUR_ID > src/types/database.types.ts
```

---

## 🧭 When to Switch Models

### Switch to Opus (🧠) When:
- [ ] Planning multi-file refactoring
- [ ] Implementing FastSpring webhooks
- [ ] Modifying tier enforcement logic
- [ ] Creating/updating database migrations
- [ ] Auditing security (RLS policies, API routes)
- [ ] Debugging complex state management
- [ ] Reviewing revenue-critical code

### Switch to Sonnet (⚡) When:
- [ ] Fixing UI layout issues
- [ ] Adjusting component styles
- [ ] Cleaning up console statements
- [ ] Organizing imports
- [ ] Fixing TypeScript warnings
- [ ] Quick debugging (isolated bugs)
- [ ] Updating documentation

### Use Auto (🤖) When:
- [ ] Regular feature development
- [ ] Mixed coding sessions
- [ ] Unsure of complexity
- [ ] Following existing patterns
- [ ] Pair programming with Cursor

---

## 💡 Pro Tips for Atlas Development

### 1. Cece + Cursor Workflow
```
┌─────────────┐     Plan      ┌──────────┐
│   ChatGPT   │ ──────────────>│  Cursor  │
│  (Strategy) │               │ (Execute) │
└─────────────┘     Verify    └──────────┘
       ^            <──────────      |
       └─────────────────────────────┘
```

**Best Practice:**
1. Open ChatGPT (Cece) for strategy and planning
2. Use Cursor for execution and rapid iteration
3. Return to ChatGPT for verification and next steps

### 2. Quota Management
- **Auto mode** saves quota while maintaining quality
- **Opus mode** for ~20% of work (high-impact tasks)
- **Sonnet mode** for ~40% of work (UI/debugging)
- **Auto mode** for ~40% of work (mixed tasks)

### 3. Before Pushing to Production
```bash
# Complete verification checklist
npm run typecheck  # 0 errors
npm run build      # Successful
npm test           # All passing
git status         # Clean or ready to commit

# Check console pollution
grep -r "console\." src --exclude-dir=node_modules --exclude="logger.ts" | wc -l
# Should return 0

# Then commit and push
git add -A
git commit -m "feat: descriptive message"
git push origin main
```

### 4. Emergency Debugging
When production is down:
```bash
# 1. Immediately switch to Opus
/set-model claude-3-opus

# 2. Open ChatGPT for parallel analysis
# Share error logs and context

# 3. Use Cursor's full scan
# Cmd+K → "Full Project Scan - Priority: Production Issue"

# 4. Execute fix with maximum reliability
# Opus ensures comprehensive solution

# 5. Verify immediately
npm run build && npm run typecheck
```

---

## 🎯 Success Metrics

Track your Ultra investment ROI:
- ✅ **One-shot fixes**: Fewer loops, faster resolution
- ✅ **Proactive prevention**: Catching issues before production
- ✅ **Quota efficiency**: Using right model for right task
- ✅ **Velocity**: More features shipped per week
- ✅ **Quality**: Fewer production bugs

---

## 🔗 Quick Links

- [Atlas Production Readiness Plan](./atlas-production-readiness.plan.md)
- [Clean Implementation TODO](./CLEAN_IMPLEMENTATION_TODO.md)
- [Migration Status](./MIGRATION_STATUS.md)

---

## 📝 Model Switching Examples

### Example 1: New Feature Development
```bash
# Task: Add habit tracking widget to dashboard
/set-model auto

# Auto will use:
# - Sonnet for UI components
# - Opus for database integration
# - Balanced approach overall
```

### Example 2: Security Audit
```bash
# Task: Review and update RLS policies
/set-model claude-3-opus

# Opus provides:
# - Multi-table analysis
# - Security vulnerability detection
# - Comprehensive policy recommendations
```

### Example 3: UI Polish Session
```bash
# Task: Fix styling issues across components
/set-model claude-3.5-sonnet

# Sonnet delivers:
# - Fast iteration cycles
# - Visual feedback
# - Quick CSS/Tailwind fixes
```

---

## 🎓 Remember

> **Ultra ChatGPT Pro Standard:**  
> One-prompt precision, production-safe execution, proactive diagnostics, and zero wasted loops.

**Your $200/month investment delivers:**
- World-class technical expertise (ChatGPT)
- Elite execution speed (Cursor)
- Intelligent model routing (Auto mode)
- Production-perfect results

---

**Last Updated:** October 17, 2025  
**Status:** ✅ 100% Clean Implementation  
**Git Tag:** `atlas-clean-implementation`

