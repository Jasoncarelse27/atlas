# Atlas Secret Scanning & Security Checks

This document explains how **Atlas** handles secret scanning and what developers should do to keep secrets out of the repo.

---

## 1. Tools Used

We use **Gitleaks** as the primary secret scanner:

- ✅ Detects API keys, tokens, passwords, and other secrets
- ✅ Uses entropy + pattern-based detection
- ✅ Configurable via `.gitleaks.toml`
- ✅ Runs **locally (pre-commit)** and **in CI (GitHub Actions)**

We also maintain a **fallback regex-based scanner** for environments where Gitleaks is not installed.

---

## 2. Local Developer Workflow

### 2.1 Pre-Commit Hook

The project uses a Git pre-commit hook (via Husky) that:

1. **Tries to run `gitleaks`** with the project config:
   ```bash
   gitleaks protect --staged --config .gitleaks.toml
   ```

2. **If gitleaks is not installed**, it falls back to:
   ```bash
   scripts/pre-commit-security-scan-improved.sh
   ```

This fallback script:
- Uses curated regex patterns to catch obvious keys/tokens
- Skips known-safe files like docs, examples, and test harness scripts
- Exits with a non-zero status if a potential secret is found

### 2.2 Installing Gitleaks Locally

**On macOS (Homebrew):**
```bash
brew install gitleaks
```

For other platforms, see the [official Gitleaks repository](https://github.com/gitleaks/gitleaks).

Once installed, the pre-commit hook will automatically start using Gitleaks.

### 2.3 Running Gitleaks Manually

**To scan staged files:**
```bash
gitleaks protect --staged --config .gitleaks.toml
```

**To scan the entire repo:**
```bash
gitleaks detect --config .gitleaks.toml
```

---

## 3. CI/CD Secret Scanning (GitHub Actions)

Secret scanning also runs in GitHub Actions via:
- `.github/workflows/secret-scan.yml` (standalone workflow)
- `.github/workflows/atlas-unified-ci-cd.yml` (required job before build)

These workflows:
- ✅ Run on every push to `main` and on every pull request
- ✅ Run daily at 3 AM UTC (scheduled scan)
- ✅ Check out the repo
- ✅ Run Gitleaks with `.gitleaks.toml`
- ✅ Fail the build if leaks are detected
- ✅ Send Slack/Discord alerts on failure

**Important:** Even if someone bypasses local pre-commit hooks, CI will block merges that introduce secrets into the main branch.

---

## 4. Allowlists and Test Files

Some files are explicitly allowlisted because they contain mock tokens or test data, not real secrets. These are documented in:
- `.gitleaks.toml` (global allowlist / files array)
- `.gitleaksignore` (gitignore-style patterns)

**Examples include:**
- **IAP test harness scripts:**
  - `test-iap-endpoint.sh`
  - `test-iap-local.sh`
  - `test-iap-browser.js`
- **Example env files:**
  - `.env.example`
  - `supabase.env.example`
- **Security scripts:**
  - `scripts/pre-commit-security-scan*.sh`
  - `scripts/check-env.sh`

**⚠️ Do not add real secrets to these files.** They are only for mock/test data.

---

## 5. What to Do If Gitleaks Finds a Leak

If a leak is detected locally or in CI:

1. **Stop and inspect the file.**

2. **If it's a real secret:**
   - Remove it from the code and commit history if necessary.
   - Rotate the secret (invalidate and recreate the key/token) in the provider (Supabase, Anthropic, FastSpring, etc.).
   - Notify the team if the secret was exposed.

3. **If it's a false positive** (e.g., a mock token or obvious test value):
   - Confirm it is safe.
   - Add a suitable allowlist entry to `.gitleaks.toml` or `.gitleaksignore` with a short comment.
   - Commit the updated config.

---

## 6. Developer Checklist Before Pushing

Before pushing or opening a PR:

- ✅ Run tests: `npm test` (if available)
- ✅ Run lint/build: `npm run lint` and `npm run build`
- ✅ Ensure pre-commit hooks run successfully
- ✅ Make sure `gitleaks protect --staged --config .gitleaks.toml` returns "no leaks found"

If all checks pass, your changes are safe to push from a secret scanning perspective.

---

## 7. Security Layers

Atlas uses **multi-layer defense**:

| Layer | Tool | Coverage |
|-------|------|----------|
| **Pre-Commit** | Gitleaks (primary) / Custom (fallback) | Staged files |
| **CI/CD** | Gitleaks | All PR/push changes |
| **Daily Scan** | Gitleaks | Full git history |
| **Main Pipeline** | Gitleaks | Blocks builds if secrets found |

---

## 8. Configuration Files

- **`.gitleaks.toml`** - Main Gitleaks configuration (rules, allowlists)
- **`.gitleaksignore`** - Gitignore-style file exclusions
- **`.husky/pre-commit`** - Pre-commit hook script
- **`scripts/pre-commit-security-scan-improved.sh`** - Fallback scanner

---

## 9. Quick Reference

**Install Gitleaks:**
```bash
brew install gitleaks
```

**Test locally:**
```bash
gitleaks protect --staged --config .gitleaks.toml
```

**Bypass pre-commit (NOT RECOMMENDED):**
```bash
git commit --no-verify -m "message"
```

**View CI scan results:**
- Check GitHub Actions → `secret-scan` workflow
- Check GitHub Actions → `atlas-unified-ci-cd` → `secret-scan` job

---

**Last Updated:** November 20, 2025  
**Security Level:** 🟢 95%+ (Industry Standard)

