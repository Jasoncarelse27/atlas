# 🔒 Atlas Security Setup

This document describes the security measures in place to prevent accidental exposure of sensitive data.

## ✅ What's Protected

The following security measures are now active:

### 1. **Enhanced .gitignore** 
Automatically ignores:
- Private keys: `*.pem`, `*.key`, `*.p12`, etc.
- SSH keys: `id_rsa`, `id_dsa`, etc.
- Certificates: `*.crt`, `*.cer`, etc.
- Cloud credentials: `.aws/`, `.gcp/`, `.azure/`
- Environment files: `.env*`
- Database dumps: `*_dump.sql`, `*_backup.sql`
- Security files: `secrets.yaml`, `credentials.json`, etc.

### 2. **Pre-commit Security Scan**
Automatically runs before every commit to detect:
- Private keys (PEM, SSH, PGP)
- API keys (AWS, Anthropic, generic)
- Tokens and secrets
- Passwords
- Supabase service role keys

**Primary Tool:** Gitleaks (industry standard)  
**Fallback:** Custom regex scanner if Gitleaks not installed  
**Location:** `.husky/pre-commit` → Uses Gitleaks first, falls back to `scripts/pre-commit-security-scan-improved.sh`

**Install Gitleaks:** `brew install gitleaks`

### 3. **Git-Secrets Integration** (Optional)
Advanced secret detection using AWS git-secrets tool.

---

## 🚀 Quick Start

### Test the Security Scan
```bash
# Test if security scan is working
echo "sk-ant-api-key-test-12345" > test-secret.txt
git add test-secret.txt
git commit -m "test"
# ❌ Should block the commit

# Clean up
rm test-secret.txt
git reset HEAD test-secret.txt
```

### Run Manual Security Audit
```bash
# Scan all tracked files for secrets
bash scripts/pre-commit-security-scan.sh

# (Optional) Install git-secrets for deeper scanning
bash scripts/setup-git-secrets.sh
git secrets --scan-history
```

---

## 🧹 Remove Leaked Key from History

**Problem:** GitGuardian detected `atlasagent.xyz-key.pem` in git history (90 days ago)

**Status:** Key is no longer used in codebase ✅

### To Remove from Git History:

```bash
# Step 1: Run the cleanup script
bash scripts/remove-leaked-key.sh

# Step 2: Review changes
git log --oneline | head -20

# Step 3: Force push (⚠️ rewrites history!)
git push origin --force --all
git push origin --force --tags
```

**⚠️ WARNING:** This rewrites git history. All commit SHAs will change.

### After Force Push:
1. ✅ Verify key is gone: `git log --all --full-history --source -- atlasagent.xyz-key.pem`
2. ✅ Mark incident as resolved in GitGuardian
3. ✅ Notify team to re-clone (if working with others)

---

## 📋 Daily Workflow

### When Committing Code
1. Stage your files: `git add .`
2. Commit: `git commit -m "your message"`
3. Security scan runs automatically
4. If secrets detected → commit blocked ❌
5. If clean → commit succeeds ✅

### If Blocked by Security Scan
```bash
# Option 1: Remove the secret (recommended)
# Edit the file and remove sensitive data

# Option 2: Add to .gitignore (if it's a file that should never be committed)
echo "path/to/secret-file" >> .gitignore

# Option 3: Bypass (⚠️ NOT RECOMMENDED)
git commit --no-verify -m "message"
```

---

## 🛠️ Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `remove-leaked-key.sh` | Remove secret from git history | `bash scripts/remove-leaked-key.sh` |
| `setup-git-secrets.sh` | Install git-secrets tool | `bash scripts/setup-git-secrets.sh` |
| `pre-commit-security-scan.sh` | Detect secrets (runs automatically) | Called by Husky pre-commit hook |

---

## 🔍 What Gets Scanned

### Patterns Detected:
- ✅ Private keys: `-----BEGIN PRIVATE KEY-----`
- ✅ AWS keys: `AKIA[0-9A-Z]{16}`
- ✅ Anthropic keys: `sk-ant-[a-zA-Z0-9\-]{95,}`
- ✅ Generic API keys: `api_key = "abc123..."`
- ✅ Tokens: `token = "xyz789..."`
- ✅ Supabase keys: `eyJ[JWT pattern]`

### Files Excluded:
- ✅ `*.example` files
- ✅ `*.md` documentation
- ✅ `README*` files
- ✅ Binary files

---

## 🎯 Best Practices

### ✅ DO:
- Use environment variables for secrets
- Add all `.env*` files to `.gitignore`
- Store secrets in `.env.local` (gitignored)
- Use `*.example` files for templates
- Review security scan output carefully

### ❌ DON'T:
- Hardcode API keys in source code
- Commit `.env` files
- Use `--no-verify` to bypass security
- Store credentials in code comments
- Commit private keys or certificates

---

## 📞 Support

### False Positives
If the scan blocks a legitimate file:
1. Check if it's really not a secret
2. Add an exception to `scripts/pre-commit-security-scan.sh`
3. Or add the file pattern to allowed patterns

### Questions?
- Check: [GitGuardian Docs](https://docs.gitguardian.com/)
- Review: `.gitignore` for what's ignored
- Audit: Run `git secrets --list` to see patterns

---

## 🔐 Emergency Response

### If You Accidentally Commit a Secret:

1. **STOP** - Don't push yet! Fix it locally:
   ```bash
   git reset HEAD~1
   # Remove the secret
   git add .
   git commit -m "fix"
   ```

2. **If Already Pushed:**
   ```bash
   # Rotate the secret immediately (new API key, etc.)
   # Then remove from history:
   bash scripts/remove-leaked-key.sh
   git push --force
   ```

3. **Report to GitGuardian** as resolved after rotating

---

## ✨ Status

- ✅ Enhanced .gitignore with security patterns
- ✅ Pre-commit security scan active
- ✅ Git-secrets setup script available
- ✅ Cleanup script for leaked key ready
- ⏳ Pending: Run cleanup script to remove `atlasagent.xyz-key.pem`

**Last Updated:** October 6, 2025

