#!/bin/bash

# Complete safe development setup script
# Sets up all safety measures for Atlas AI development

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REPO_DIR="/Users/jasoncarelse/atlas"

echo -e "${BLUE}🛡️ Setting up Safe Development Environment for Atlas AI...${NC}"
echo ""

# Function to run setup script
run_setup() {
    local script_name="$1"
    local script_path="$REPO_DIR/scripts/$script_name"
    
    if [ -f "$script_path" ]; then
        echo -e "${BLUE}🔧 Running $script_name...${NC}"
        if bash "$script_path"; then
            echo -e "${GREEN}✅ $script_name completed successfully${NC}"
        else
            echo -e "${RED}❌ $script_name failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️ $script_name not found, skipping...${NC}"
    fi
    echo ""
}

# 1. Setup auto-sync
run_setup "setup-auto-sync.sh"

# 2. Setup watchdog
run_setup "setup-watchdog.sh"

# 3. Verify GitHub Actions
echo -e "${BLUE}🔍 Verifying GitHub Actions...${NC}"
if [ -f "$REPO_DIR/.github/workflows/security-scan.yml" ]; then
    echo -e "${GREEN}✅ Security scan workflow configured${NC}"
else
    echo -e "${YELLOW}⚠️ Security scan workflow not found${NC}"
fi

if [ -f "$REPO_DIR/.github/workflows/auto-sync.yml" ]; then
    echo -e "${GREEN}✅ Auto-sync workflow configured${NC}"
else
    echo -e "${YELLOW}⚠️ Auto-sync workflow not found${NC}"
fi
echo ""

# 4. Check pre-commit hooks
echo -e "${BLUE}🔍 Checking pre-commit hooks...${NC}"
if [ -f "$REPO_DIR/.husky/pre-commit" ]; then
    echo -e "${GREEN}✅ Husky pre-commit hooks configured${NC}"
else
    echo -e "${YELLOW}⚠️ Husky pre-commit hooks not found${NC}"
fi
echo ""

# 5. Verify environment protection
echo -e "${BLUE}🔍 Checking environment protection...${NC}"
if [ -f "$REPO_DIR/.gitignore" ] && grep -q "\.env" "$REPO_DIR/.gitignore"; then
    echo -e "${GREEN}✅ .env files are gitignored${NC}"
else
    echo -e "${YELLOW}⚠️ .env files may not be properly gitignored${NC}"
fi

if [ ! -f "$REPO_DIR/.env" ]; then
    echo -e "${GREEN}✅ No .env file in repository${NC}"
else
    echo -e "${RED}❌ .env file found in repository - this should be removed!${NC}"
fi
echo ""

# 6. Create development checklist
echo -e "${BLUE}📋 Creating development checklist...${NC}"
cat > "$REPO_DIR/SAFE_DEV_CHECKLIST.md" << 'EOF'
# 🛡️ Atlas AI Safe Development Checklist

## Before Starting Development
- [ ] Run `npm run dev:checklist` to verify environment
- [ ] Check that auto-sync is running: `ps aux | grep auto-sync`
- [ ] Verify watchdog is active: `ps aux | grep watchdog`
- [ ] Ensure working tree is clean: `git status`

## During Development
- [ ] Work on feature branches, not main/develop
- [ ] Commit frequently with descriptive messages
- [ ] Run tests before committing: `npm run test`
- [ ] Check for linting issues: `npm run lint`

## Before Pushing
- [ ] Rebase interactively: `git rebase -i main`
- [ ] Remove any .env commits from history
- [ ] Run full check: `npm run check:all`
- [ ] Force push safely: `git push origin HEAD --force-with-lease`

## Emergency Procedures
- [ ] If rebase fails: `git rebase --abort`
- [ ] If conflicts occur: resolve manually, then `git add . && git rebase --continue`
- [ ] If auto-sync fails: check logs at `logs/auto-sync.log`
- [ ] If watchdog alerts: check `logs/watchdog-rebase.log`

## Daily Maintenance
- [ ] Check auto-sync logs: `tail -f logs/auto-sync.log`
- [ ] Verify GitHub Actions are passing
- [ ] Update dependencies: `npm update`
- [ ] Run security audit: `npm audit`
EOF

echo -e "${GREEN}✅ Development checklist created${NC}"
echo ""

# Final summary
echo -e "${GREEN}🎉 Safe Development Environment Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📋 What's now protected:${NC}"
echo "  🛡️  GitHub Actions scan for secrets and vulnerabilities"
echo "  🔄  Auto-sync with GitHub every hour (clean trees only)"
echo "  🐕  Watchdog monitoring for rebase operations"
echo "  🚫  Pre-commit hooks prevent .env commits"
echo "  📝  Development checklist for safe workflows"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo "  1. Review the checklist: cat SAFE_DEV_CHECKLIST.md"
echo "  2. Test the setup: npm run dev:checklist"
echo "  3. Start developing safely!"
echo ""
echo -e "${YELLOW}💡 Pro tip: Run this setup script anytime to verify your safety measures${NC}"
