#!/bin/bash

# Script to set up git-secrets to prevent committing sensitive data
# This will scan for API keys, private keys, and other secrets

set -e

echo "🔐 Git Secrets Setup"
echo "===================="
echo ""

# Check if git-secrets is installed
if ! command -v git-secrets &> /dev/null; then
    echo "📦 Installing git-secrets..."
    if command -v brew &> /dev/null; then
        brew install git-secrets
    else
        echo "❌ Homebrew not found. Installing manually..."
        git clone https://github.com/awslabs/git-secrets.git /tmp/git-secrets
        cd /tmp/git-secrets
        sudo make install
        cd -
        rm -rf /tmp/git-secrets
    fi
    echo "✅ git-secrets installed"
else
    echo "✅ git-secrets already installed"
fi

echo ""
echo "🔧 Configuring git-secrets for this repository..."

# Install git-secrets hooks
git secrets --install -f

# Add common patterns to prevent committing
echo "📝 Adding secret patterns..."

# AWS keys
git secrets --add 'AKIA[0-9A-Z]{16}'
git secrets --add '(\"|'\'')[0-9a-zA-Z/+]{40}(\"|'\'')'

# Private keys
git secrets --add '-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----'
git secrets --add '-----BEGIN PRIVATE KEY-----'
git secrets --add '-----BEGIN PGP PRIVATE KEY BLOCK-----'

# Generic API keys and tokens
git secrets --add '[a|A][p|P][i|I][_]?[k|K][e|E][y|Y].*['\''|\"][0-9a-zA-Z]{32,45}['\''|\"]'
git secrets --add '[s|S][e|E][c|C][r|R][e|E][t|T].*['\''|\"][0-9a-zA-Z]{32,45}['\''|\"]'
git secrets --add '[t|T][o|O][k|K][e|E][n|N].*['\''|\"][0-9a-zA-Z]{32,45}['\''|\"]'

# Anthropic API keys
git secrets --add 'sk-ant-[a-zA-Z0-9\\-]{95,}'

# Supabase keys
git secrets --add 'eyJ[a-zA-Z0-9_-]{50,}\.[a-zA-Z0-9_-]{50,}\.[a-zA-Z0-9_-]{50,}'

# Add allowed patterns (to reduce false positives)
git secrets --add --allowed 'env.example'
git secrets --add --allowed 'YOUR_API_KEY'
git secrets --add --allowed 'your-api-key'
git secrets --add --allowed 'EXAMPLE_KEY'
git secrets --add --allowed '\.md$'
git secrets --add --allowed 'README'

echo ""
echo "✅ Git secrets configuration complete!"
echo ""
echo "🧪 Testing on current files..."
if git secrets --scan; then
    echo "✅ No secrets detected in current files"
else
    echo "⚠️  Secrets detected! Review the output above."
fi

echo ""
echo "📋 What git-secrets does:"
echo "   • Pre-commit hook: Scans staged files before commit"
echo "   • Pre-push hook: Scans all commits before push"  
echo "   • Commit-msg hook: Scans commit messages"
echo ""
echo "🎯 To manually scan:"
echo "   git secrets --scan              # Scan tracked files"
echo "   git secrets --scan-history      # Scan entire history"
echo "   git secrets --list              # Show patterns"

