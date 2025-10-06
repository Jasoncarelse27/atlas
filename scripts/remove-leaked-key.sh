#!/bin/bash

# Script to remove atlasagent.xyz-key.pem from git history
# This uses git-filter-repo which is safer than git filter-branch

set -e

echo "🔒 Git History Cleanup Script"
echo "============================="
echo ""
echo "This will remove atlasagent.xyz-key.pem from git history"
echo ""

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Backup current branch
current_branch=$(git branch --show-current)
echo "📍 Current branch: $current_branch"

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &> /dev/null; then
    echo "📦 git-filter-repo not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install git-filter-repo
    elif command -v pip3 &> /dev/null; then
        pip3 install git-filter-repo
    else
        echo "❌ Please install git-filter-repo manually:"
        echo "   brew install git-filter-repo"
        echo "   OR"
        echo "   pip3 install git-filter-repo"
        exit 1
    fi
fi

echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo "   - All commit SHAs will change"
echo "   - You'll need to force push to remote"
echo "   - Other developers will need to re-clone"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 0
fi

echo ""
echo "🧹 Creating backup branch..."
git branch backup-before-cleanup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

echo ""
echo "🔍 Removing atlasagent.xyz-key.pem from history..."
git filter-repo --invert-paths --path atlasagent.xyz-key.pem --force

echo ""
echo "✅ Successfully removed file from git history!"
echo ""
echo "📤 Next steps:"
echo "   1. Review the changes: git log --all --oneline"
echo "   2. Force push to remote: git push origin --force --all"
echo "   3. Force push tags: git push origin --force --tags"
echo ""
echo "⚠️  Important: Notify team members to re-clone the repository!"
echo ""
echo "🎯 After force-pushing, mark the incident as resolved in GitGuardian"

