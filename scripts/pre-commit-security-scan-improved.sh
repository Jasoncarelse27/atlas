#!/bin/bash

# Pre-commit hook to detect secrets in staged files
# Uses Gitleaks (industry standard) if available, falls back to custom patterns

# ANSI color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Scanning for secrets in staged files..."

# Check if Gitleaks is available (industry standard tool)
if command -v gitleaks &> /dev/null; then
    echo "${BLUE}✅ Using Gitleaks (industry standard)${NC}"
    
    # Run Gitleaks on staged files
    if gitleaks detect --source . --no-git --verbose --config .gitleaks.toml --staged 2>&1 | grep -q "leak detected"; then
        echo ""
        echo "${RED}❌ SECRETS DETECTED BY GITLEAKS!${NC}"
        echo "${RED}================================${NC}"
        echo ""
        gitleaks detect --source . --no-git --verbose --config .gitleaks.toml --staged
        echo ""
        echo "${RED}🚫 Commit blocked to prevent secret exposure${NC}"
        echo ""
        echo "${YELLOW}If this is a false positive:${NC}"
        echo "   1. Review the flagged files carefully"
        echo "   2. Add to .gitleaksignore if safe"
        echo "   3. Use git commit --no-verify to bypass (NOT RECOMMENDED)"
        echo ""
        exit 1
    else
        echo "${GREEN}✅ No secrets detected by Gitleaks${NC}"
        exit 0
    fi
else
    # Fallback to custom patterns if Gitleaks not installed
    echo "${YELLOW}⚠️  Gitleaks not found, using custom patterns${NC}"
    echo "${YELLOW}   Install Gitleaks for better detection: brew install gitleaks${NC}"
    echo ""
    
    # Get list of staged files
    STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
    
    if [ -z "$STAGED_FILES" ]; then
        echo "${GREEN}✅ No files to scan${NC}"
        exit 0
    fi
    
    # Patterns to detect (macOS-compatible)
    PATTERNS=(
        # Private keys - split into separate patterns for macOS compatibility
        "-----BEGIN RSA PRIVATE KEY"
        "-----BEGIN DSA PRIVATE KEY"
        "-----BEGIN EC PRIVATE KEY"
        "-----BEGIN OPENSSH PRIVATE KEY"
        "-----BEGIN PGP PRIVATE KEY"
        "-----BEGIN PRIVATE KEY-----"
        
        # AWS keys
        "AKIA[0-9A-Z]\{16\}"
        
        # Anthropic API keys
        "sk-ant-[a-zA-Z0-9\-]\{95,\}"
        
        # Generic secrets (but not in .example files)
        "api[_-]key['\"]\?[[:space:]]*[:=][[:space:]]*['\"][a-zA-Z0-9]\{32,\}"
        "secret['\"]\?[[:space:]]*[:=][[:space:]]*['\"][a-zA-Z0-9]\{32,\}"
        "token['\"]\?[[:space:]]*[:=][[:space:]]*['\"][a-zA-Z0-9]\{32,\}"
        "password['\"]\?[[:space:]]*[:=][[:space:]]*['\"][^'\"]\{8,\}"
        
        # Supabase service role keys (JWT pattern)
        "eyJ[a-zA-Z0-9_-]\{100,\}"
    )
    
    FOUND_SECRETS=false
    
    # Check each staged file
    for file in $STAGED_FILES; do
        # Skip binary files
        if file "$file" 2>/dev/null | grep -q "binary"; then
            continue
        fi
        
        # Skip .example files, docs, test files, and security scripts
        if [[ "$file" == *.example ]] || \
           [[ "$file" == *.md ]] || \
           [[ "$file" == *README* ]] || \
           [[ "$file" == *test.ts ]] || \
           [[ "$file" == *test.tsx ]] || \
           [[ "$file" == *test.js ]] || \
           [[ "$file" == test-*.sh ]] || \
           [[ "$file" == test-*.js ]] || \
           [[ "$file" == test-iap-*.sh ]] || \
           [[ "$file" == test-iap-*.js ]] || \
           [[ "$file" == *test-*.sh ]] || \
           [[ "$file" == scripts/test-* ]] || \
           [[ "$file" == scripts/pre-commit-security-scan*.sh ]] || \
           [[ "$file" == scripts/check-env.sh ]] || \
           [[ "$file" == scripts/setup-git-secrets.sh ]] || \
           [[ "$file" == scripts/*security*.sh ]] || \
           [[ "$file" == scripts/*secret*.sh ]]; then
            continue
        fi
        
        # Check for each pattern (macOS-compatible grep)
        for pattern in "${PATTERNS[@]}"; do
            # Use grep with proper quoting to prevent pattern from being interpreted as options
            if git diff --cached "$file" 2>/dev/null | grep -iE -- "$pattern" > /dev/null 2>&1; then
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
        echo "${BLUE}💡 Tip: Install Gitleaks for better detection: brew install gitleaks${NC}"
        echo ""
        exit 1
    else
        echo "${GREEN}✅ No secrets detected${NC}"
        exit 0
    fi
fi

