#!/bin/bash

# Pre-commit hook to detect secrets in staged files
# This runs automatically before each commit

# ANSI color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Scanning for secrets in staged files..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo "${GREEN}✅ No files to scan${NC}"
    exit 0
fi

# Patterns to detect
PATTERNS=(
    # Private keys
    "-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY"
    "-----BEGIN PRIVATE KEY-----"
    
    # AWS keys
    "AKIA[0-9A-Z]{16}"
    
    # Anthropic API keys
    "sk-ant-[a-zA-Z0-9\-]{95,}"
    
    # Generic secrets (but not in .example files)
    "api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{32,}"
    "secret['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{32,}"
    "token['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{32,}"
    "password['\"]?\s*[:=]\s*['\"][^'\"]{8,}"
    
    # Supabase service role keys (JWT pattern)
    "eyJ[a-zA-Z0-9_-]{100,}"
)

FOUND_SECRETS=false

# Check each staged file
for file in $STAGED_FILES; do
    # Skip binary files
    if file "$file" | grep -q "binary"; then
        continue
    fi
    
    # Skip .example files and docs
    if [[ "$file" == *.example ]] || [[ "$file" == *.md ]] || [[ "$file" == *README* ]]; then
        continue
    fi
    
    # Check for each pattern
    for pattern in "${PATTERNS[@]}"; do
        if git diff --cached "$file" | grep -iE "$pattern" > /dev/null; then
            if [ "$FOUND_SECRETS" = false ]; then
                echo ""
                echo "${RED}❌ POTENTIAL SECRETS DETECTED!${NC}"
                echo "${RED}================================${NC}"
                echo ""
                FOUND_SECRETS=true
            fi
            echo "${YELLOW}⚠️  Found in: $file${NC}"
            echo "   Pattern: $pattern"
            echo ""
        fi
    done
done

if [ "$FOUND_SECRETS" = true ]; then
    echo "${RED}🚫 Commit blocked to prevent secret exposure${NC}"
    echo ""
    echo "${YELLOW}If this is a false positive:${NC}"
    echo "   1. Review the flagged files carefully"
    echo "   2. Use git commit --no-verify to bypass (NOT RECOMMENDED)"
    echo "   3. Or add the pattern to .gitignore"
    echo ""
    exit 1
else
    echo "${GREEN}✅ No secrets detected${NC}"
    exit 0
fi

