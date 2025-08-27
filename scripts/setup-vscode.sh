#!/bin/bash

# VS Code Setup Script for Atlas Project
# Run this script to quickly configure VS Code for optimal performance

set -e

echo "🚀 VS Code Setup for Atlas Project"
echo "=================================="

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

# Check if we're in the Atlas project directory
if [ ! -f "package.json" ] || [ ! -f "vite.config.ts" ]; then
    print_error "Please run this script from the Atlas project root directory"
    exit 1
fi

print_status "Setting up VS Code for optimal performance..."

# 1. Check if .vscode directory exists
if [ ! -d ".vscode" ]; then
    print_error ".vscode directory not found. Please ensure VS Code configuration files are present."
    exit 1
fi

# 2. Verify configuration files
REQUIRED_FILES=("settings.json" "extensions.json" "tasks.json" "launch.json" "snippets.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f ".vscode/$file" ]; then
        print_success "✓ $file found"
    else
        print_warning "⚠ $file not found"
    fi
done

# 3. Check if scripts directory exists
if [ ! -d "scripts" ]; then
    print_error "scripts directory not found"
    exit 1
fi

# 4. Verify maintenance scripts
MAINTENANCE_SCRIPTS=("vscode-maintenance.sh" "performance-monitor.sh")
for script in "${MAINTENANCE_SCRIPTS[@]}"; do
    if [ -f "scripts/$script" ]; then
        if [ -x "scripts/$script" ]; then
            print_success "✓ $script is executable"
        else
            print_warning "⚠ $script is not executable, fixing..."
            chmod +x "scripts/$script"
            print_success "✓ $script is now executable"
        fi
    else
        print_error "✗ $script not found"
    fi
done

# 5. Check VS Code installation
if command -v code &> /dev/null; then
    print_success "✓ VS Code is installed"
else
    print_warning "⚠ VS Code command line tool not found"
    print_status "To install VS Code command line tool:"
    print_status "1. Open VS Code"
    print_status "2. Press Cmd+Shift+P"
    print_status "3. Type 'Shell Command: Install code command in PATH'"
    print_status "4. Press Enter"
fi

# 6. Check for recommended extensions
print_status "Checking for recommended extensions..."
if command -v code &> /dev/null; then
    print_status "VS Code will prompt you to install recommended extensions when you open the project."
    print_status "Click 'Install All' to get the essential tools."
else
    print_warning "Cannot check extensions without VS Code command line tool"
fi

# 7. Create .gitignore entries if needed
if [ -f ".gitignore" ]; then
    # Check if VS Code entries are already in .gitignore
    if ! grep -q ".vscode/" .gitignore; then
        print_status "Adding VS Code entries to .gitignore..."
        echo "" >> .gitignore
        echo "# VS Code" >> .gitignore
        echo ".vscode/chrome-debug-profile/" >> .gitignore
        echo ".vscode/chrome-debug-profile-incognito/" >> .gitignore
        print_success "✓ Added VS Code entries to .gitignore"
    else
        print_success "✓ VS Code entries already in .gitignore"
    fi
else
    print_warning "⚠ .gitignore not found"
fi

# 8. Check Node.js and npm
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "✓ Node.js $NODE_VERSION is installed"
else
    print_error "✗ Node.js is not installed"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "✓ npm $NPM_VERSION is installed"
else
    print_error "✗ npm is not installed"
    exit 1
fi

# 9. Check project dependencies
if [ -d "node_modules" ]; then
    print_success "✓ Dependencies are installed"
else
    print_warning "⚠ Dependencies not installed, installing now..."
    npm install
    print_success "✓ Dependencies installed"
fi

# 10. Run initial performance check
print_status "Running initial performance check..."
if [ -f "scripts/performance-monitor.sh" ]; then
    ./scripts/performance-monitor.sh
else
    print_warning "⚠ Performance monitor script not found"
fi

echo
print_success "VS Code setup completed!"
echo
print_status "Next steps:"
echo "1. Open the project in VS Code: code ."
echo "2. Install recommended extensions when prompted"
echo "3. Restart VS Code: Cmd+Shift+P > 'Developer: Reload Window'"
echo "4. Test the development server: npm run dev"
echo "5. Check IntelliSense and auto-completion"
echo
print_status "Useful commands:"
echo "• npm run vscode:performance - Check performance"
echo "• npm run vscode:maintenance - Run maintenance (monthly)"
echo "• npm run pre-commit - Run quality checks"
echo "• npm run clean - Clean build artifacts"
echo
print_status "For detailed information, see: VS_CODE_OPTIMIZATION_GUIDE.md"
echo
print_success "Setup completed at $(date)"
