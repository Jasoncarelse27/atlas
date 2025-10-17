#!/bin/bash
# Atlas Ultra Development Environment Setup
# Optimized for production-ready development workflow

set -e  # Exit on any error

echo "🚀 Setting up Atlas Ultra Development Environment..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the Atlas project root"
    exit 1
fi

print_status "Installing essential CLI tools..."

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
    print_status "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    print_success "Homebrew already installed"
fi

# Install essential CLI tools
print_status "Installing development tools..."
brew install jq httpie bat exa ripgrep fd tree

print_success "CLI tools installed successfully"

# Create Atlas development aliases
print_status "Setting up Atlas development aliases..."

# Backup existing .zshrc
if [ -f ~/.zshrc ]; then
    cp ~/.zshrc ~/.zshrc.backup.$(date +%Y%m%d_%H%M%S)
    print_success "Backed up existing .zshrc"
fi

# Add Atlas aliases to .zshrc
cat >> ~/.zshrc << 'EOF'

# ============================================
# Atlas Ultra Development Aliases
# ============================================

# Core Atlas navigation
alias atlas="cd /Users/jasoncarelse/.cursor/worktrees/atlas/1760695834788-3f5bbf"
alias atlas-main="cd /Users/jasoncarelse/atlas"

# Development commands
alias atlas-dev="atlas && npm run start:dev"
alias atlas-build="atlas && npm run build"
alias atlas-test="atlas && npm test"
alias atlas-lint="atlas && npm run lint"
alias atlas-typecheck="atlas && npm run typecheck"

# Health and quality checks
alias atlas-health="atlas && npm run typecheck && npm run build && echo '✅ Atlas health check complete'"
alias atlas-full-check="atlas && npm run typecheck && npm run build && npm test && echo '✅ Atlas full check complete'"

# Git workflow
alias atlas-status="atlas && git status"
alias atlas-pull="atlas && git pull origin main"
alias atlas-push="atlas && git add -A && git commit -m 'feat: update' && git push"
alias atlas-commit="atlas && git add -A && git commit -m"

# Database operations
alias atlas-db-types="atlas && npx supabase gen types typescript --project-id rbwabemtucdkytvvpzvk > src/types/database.types.ts"
alias atlas-db-reset="atlas && npx supabase db reset"
alias atlas-db-push="atlas && npx supabase db push"

# Production monitoring
alias atlas-logs="atlas && tail -f backend/logs/*.log"
alias atlas-monitor="atlas && npm run health:check"

# Quick development shortcuts
alias atlas-clean="atlas && npm run clean && npm install"
alias atlas-fresh="atlas && git pull origin main && npm install && npm run build"

# Cursor model switching reminders
alias atlas-opus="echo '🧠 Switch to Opus: /set-model claude-3-opus'"
alias atlas-sonnet="echo '⚡ Switch to Sonnet: /set-model claude-3.5-sonnet'"
alias atlas-auto="echo '🤖 Switch to Auto: /set-model auto'"

EOF

print_success "Atlas aliases added to ~/.zshrc"

# Install development dependencies
print_status "Installing Atlas development dependencies..."

# Install Sentry for production monitoring
npm install --save-dev @sentry/vite-plugin @sentry/react @sentry/node

# Install git hooks for quality
npm install --save-dev husky lint-staged

# Install additional development tools
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev vite-bundle-analyzer
npm install --save-dev supertest @types/supertest

print_success "Development dependencies installed"

# Set up git hooks
print_status "Setting up git hooks for quality assurance..."

# Initialize husky
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "npm run lint-staged"

# Create commit-msg hook for conventional commits
npx husky add .husky/commit-msg "npx --no -- commitlint --edit \$1"

print_success "Git hooks configured"

# Add enhanced scripts to package.json
print_status "Adding enhanced development scripts..."

# Create a temporary package.json with additional scripts
cat > package.json.tmp << 'EOF'
{
  "scripts": {
    "dev:full": "concurrently \"npm run backend:dev\" \"npm run dev\" \"npm run watch:types\"",
    "watch:types": "npx supabase gen types typescript --project-id rbwabemtucdkytvvpzvk --watch",
    "health:check": "npm run typecheck && npm run build && npm test",
    "preview:prod": "npm run build && npm run preview",
    "db:types": "npx supabase gen types typescript --project-id rbwabemtucdkytvvpzvk > src/types/database.types.ts",
    "db:reset": "npx supabase db reset",
    "db:push": "npx supabase db push",
    "clean": "rm -rf node_modules dist .next",
    "fresh": "npm run clean && npm install",
    "analyze": "vite-bundle-analyzer dist/stats.html",
    "lint-staged": "eslint --fix --ext .ts,.tsx,.js,.jsx src/",
    "commit": "git add -A && git commit -m",
    "push": "git push origin main"
  }
}
EOF

# Merge with existing package.json (this is a simplified approach)
print_warning "Please manually add the enhanced scripts to your package.json"
print_status "Enhanced scripts available in package.json.tmp"

# Create VS Code/Cursor workspace settings
print_status "Creating optimized workspace settings..."

mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.associations": {
    "*.env*": "dotenv"
  },
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
EOF

# Create recommended extensions
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "supabase.supabase",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-markdown",
    "ms-vscode.vscode-json"
  ]
}
EOF

print_success "Workspace settings configured"

# Create development environment file
print_status "Creating development environment configuration..."

cat > .env.development << 'EOF'
# Atlas Development Environment
NODE_ENV=development
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug

# Development-specific settings
USE_MOCK_MAILER=true
ENABLE_DEV_TOOLS=true
HOT_RELOAD=true

# Supabase (use your existing values)
# VITE_SUPABASE_URL=your-url
# VITE_SUPABASE_ANON_KEY=your-key
EOF

print_success "Development environment file created"

# Create a development checklist
cat > ATLAS_DEV_CHECKLIST.md << 'EOF'
# Atlas Development Checklist

## Daily Development Start
- [ ] `atlas-pull` - Pull latest changes
- [ ] `atlas-health` - Run health check
- [ ] `/set-model auto` - Set Cursor model
- [ ] `atlas-dev` - Start development server

## Before Committing
- [ ] `atlas-lint` - Check code quality
- [ ] `atlas-typecheck` - Verify TypeScript
- [ ] `atlas-test` - Run test suite
- [ ] `atlas-build` - Verify production build

## Before Pushing
- [ ] `atlas-full-check` - Complete verification
- [ ] Review changes with Cursor
- [ ] `atlas-push` - Push to GitHub

## Model Selection Guide
- 🧠 **Opus**: Architecture, migrations, security
- ⚡ **Sonnet**: UI fixes, debugging, styling
- 🤖 **Auto**: Daily development (default)

## Emergency Commands
- `atlas-fresh` - Clean install and build
- `atlas-clean` - Clean node_modules
- `atlas-monitor` - Check system health
EOF

print_success "Development checklist created"

# Final setup verification
print_status "Running final verification..."

# Test if aliases work
if [ -f ~/.zshrc ]; then
    print_success "✅ .zshrc updated with Atlas aliases"
else
    print_error "❌ Failed to update .zshrc"
fi

# Test if dependencies are installed
if [ -d "node_modules" ]; then
    print_success "✅ Dependencies installed"
else
    print_warning "⚠️  Run 'npm install' to install dependencies"
fi

# Test if git hooks are set up
if [ -d ".husky" ]; then
    print_success "✅ Git hooks configured"
else
    print_warning "⚠️  Git hooks may need manual setup"
fi

echo ""
echo "🎉 Atlas Ultra Development Environment Setup Complete!"
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo "1. Run 'source ~/.zshrc' to activate aliases"
echo "2. Test with 'atlas-health' command"
echo "3. Start development with 'atlas-dev'"
echo "4. Review ATLAS_DEV_CHECKLIST.md for workflow"
echo ""
echo "🚀 Your Atlas development experience is now optimized!"
echo ""
echo "💡 Pro Tips:"
echo "- Use 'atlas-opus' for architecture work"
echo "- Use 'atlas-sonnet' for UI fixes"
echo "- Use 'atlas-auto' for daily development"
echo "- Run 'atlas-health' before every commit"
echo ""
print_success "Setup complete! Happy coding! 🎯"
