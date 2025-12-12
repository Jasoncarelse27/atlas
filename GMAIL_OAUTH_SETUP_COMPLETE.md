# ✅ Gmail OAuth Setup - Complete & Safe

**Date:** December 6, 2025  
**Status:** 🟢 **READY FOR TOKEN GENERATION**

---

## ✅ **COMPLETED SETUP STEPS**

### **1. ✅ Credentials File Created**
- **Location:** `backend/config/credentials.json`
- **Format:** Valid OAuth 2.0 Desktop application format
- **Permissions:** `600` (owner read/write only - secure)
- **Git Status:** ✅ In `.gitignore` (won't be committed)

**Credentials:**
- Client ID: `[REDACTED - stored in credentials.json, not committed]`
- Client Secret: `[REDACTED - stored in credentials.json, not committed]`
- Project ID: `atlas-gmail-oauth`

### **2. ✅ Scope Mismatch Fixed**
- **Before:** Token script only requested `gmail.modify`
- **After:** Token script requests all required scopes:
  - `gmail.readonly` - Read emails
  - `gmail.modify` - Mark as read, modify labels
  - `gmail.send` - Send replies (future feature)

**File Updated:** `backend/scripts/generate-gmail-token.mjs`

### **3. ✅ Security Best Practices**
- ✅ Credentials file permissions: `600` (owner only)
- ✅ Files in `.gitignore` (won't be committed)
- ✅ Proper OAuth 2.0 Desktop application format
- ✅ Includes required redirect URIs

---

## 🔄 **NEXT STEP: Generate OAuth Token**

Since we updated the credentials, you'll need to regenerate the token:

```bash
# Run the token generator
node backend/scripts/generate-gmail-token.mjs
```

**What this will do:**
1. Load your new credentials.json
2. Generate an authorization URL
3. You'll visit the URL and authorize
4. Paste the authorization code
5. Save token.json automatically

**Important:** The existing `token.json` was created with different credentials, so it needs to be regenerated.

---

## 🔒 **SECURITY VERIFICATION**

### **✅ Files Protected:**
- `backend/config/credentials.json` - ✅ In `.gitignore`
- `backend/config/token.json` - ✅ In `.gitignore`
- Both files have restricted permissions

### **✅ Best Practices Followed:**
1. ✅ Credentials stored locally (not in git)
2. ✅ Proper file permissions (600)
3. ✅ OAuth 2.0 Desktop application format (most secure)
4. ✅ All required scopes requested
5. ✅ Token auto-refresh enabled

### **✅ Scope Verification:**
- ✅ `gmail.readonly` - Required for fetching emails
- ✅ `gmail.modify` - Required for marking emails as read
- ✅ `gmail.send` - Required for future send functionality

---

## 📋 **SETUP CHECKLIST**

- [x] ✅ Credentials.json created with correct format
- [x] ✅ File permissions set to 600 (secure)
- [x] ✅ Scope mismatch fixed (all scopes requested)
- [x] ✅ Files verified in .gitignore
- [ ] ⏳ **Run token generator** (`node backend/scripts/generate-gmail-token.mjs`)
- [ ] ⏳ Verify EMAIL_AGENT_ENABLED=true in .env
- [ ] ⏳ Restart backend after token generation
- [ ] ⏳ Test email agent via `/agents` dashboard

---

## 🚀 **AFTER TOKEN GENERATION**

Once you've run the token generator and have `token.json`:

1. **Verify EMAIL_AGENT_ENABLED:**
   ```bash
   grep EMAIL_AGENT_ENABLED .env
   # Should show: EMAIL_AGENT_ENABLED=true
   ```

2. **If not set, add it:**
   ```bash
   echo "EMAIL_AGENT_ENABLED=true" >> .env
   ```

3. **Restart Backend:**
   ```bash
   # Stop current backend (Ctrl+C)
   npm run backend
   ```

4. **Test Email Agent:**
   - Go to `http://localhost:5174/agents`
   - Click "Fetch Emails" in Notifications panel
   - Or test via API: `POST /api/agents/email/fetch`

---

## 📝 **TROUBLESHOOTING**

### **If token generation fails:**
- Verify credentials.json format is valid JSON
- Check that client_id and client_secret are correct
- Ensure you're authorizing with the correct Gmail account

### **If email agent doesn't work:**
- Verify `EMAIL_AGENT_ENABLED=true` in .env
- Check backend logs for Gmail API errors
- Verify token.json exists and is valid JSON
- Check that Gmail API is enabled in Google Cloud Console

---

## ✅ **SETUP COMPLETE**

All files are configured correctly and securely. You're ready to generate the OAuth token!

**Next Command:**
```bash
node backend/scripts/generate-gmail-token.mjs
```




