# Staging Testing Checklist - File Upload System

## Pre-Testing Setup

1. **Verify Deployment**
   - [ ] Check Vercel dashboard - latest commit `306b924` is deployed
   - [ ] Check Railway dashboard - backend is running
   - [ ] Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R) to clear cache

2. **Verify Environment**
   - [ ] Frontend connects to correct backend API
   - [ ] Backend has `ANTHROPIC_API_KEY` configured
   - [ ] Supabase storage bucket "attachments" is accessible

## Test 1: Free Tier - Menu Visibility & Locked Options

**Steps:**
1. Log in as Free tier user
2. Navigate to chat page
3. Click the "+" button

**Expected Results:**
- [ ] Menu appears with 3 options (Photo, Camera, File)
- [ ] All options show lock icons (🔒)
- [ ] All options are grayed out/disabled
- [ ] Hover shows "Upgrade to Core or Studio" tooltip
- [ ] Clicking any option shows upgrade modal
- [ ] Menu closes on outside click or ESC key

## Test 2: Core Tier - Image Upload Only

**Steps:**
1. Log in as Core tier user
2. Click "+" button
3. Click "Photo" option

**Expected Results:**
- [ ] Menu shows "Photo" option enabled (no lock icon)
- [ ] "Camera" and "File" options show lock icons
- [ ] Clicking "Photo" opens file picker
- [ ] Can select image files (JPG, PNG, WebP, HEIC)
- [ ] Image preview appears above input
- [ ] Can add caption and send
- [ ] Image uploads to Supabase storage
- [ ] AI analysis completes successfully

**Test Image Upload:**
- [ ] Upload small image (< 1MB) - should work
- [ ] Upload large image (> 5MB) - should compress
- [ ] Upload HEIC image - should convert to JPEG
- [ ] Try invalid file type - should show error

## Test 3: Studio Tier - All Options Enabled

**Steps:**
1. Log in as Studio tier user
2. Click "+" button

**Expected Results:**
- [ ] All 3 options (Photo, Camera, File) are enabled
- [ ] No lock icons visible
- [ ] All options are clickable

**Test Camera:**
- [ ] Click "Camera" option
- [ ] Mobile: Opens camera interface
- [ ] Desktop: Opens file picker with camera option
- [ ] Can capture/select photo
- [ ] Photo preview appears
- [ ] Can send with analysis

**Test File Upload:**
- [ ] Click "File" option
- [ ] File picker shows supported types (PDF, DOCX, TXT, MP3, MP4)
- [ ] Can select PDF file
- [ ] File preview shows with FileText icon
- [ ] Can send file
- [ ] File uploads to Supabase storage
- [ ] File analysis completes

## Test 4: File Upload - Different Types

**Test Each File Type:**
- [ ] **PDF** - Upload, preview shows, analysis works
- [ ] **DOCX** - Upload, preview shows, analysis works
- [ ] **TXT** - Upload, preview shows, analysis works
- [ ] **MP3** - Upload, preview shows Music icon, analysis works
- [ ] **MP4** - Upload, preview shows Music icon, analysis works

**Test File Validation:**
- [ ] Try file > 20MB (document) - should show error
- [ ] Try file > 50MB (audio) - should show error
- [ ] Try unsupported type (.exe) - should show error
- [ ] Try empty file - should show error

## Test 5: Error Handling

**Test Upgrade Prompts:**
- [ ] Free tier clicks locked option → upgrade modal appears
- [ ] Core tier clicks Camera → upgrade modal appears
- [ ] Core tier clicks File → upgrade modal appears

**Test Upload Errors:**
- [ ] Network error during upload → shows retry button
- [ ] Analysis timeout → shows timeout error
- [ ] Invalid file → shows validation error
- [ ] Backend error → shows user-friendly error message

## Test 6: Mobile vs Desktop

**Mobile (iOS Safari / Android Chrome):**
- [ ] Menu appears correctly positioned
- [ ] Touch interactions work smoothly
- [ ] Camera option opens native camera
- [ ] File picker works correctly
- [ ] Preview cards display properly

**Desktop (Chrome / Safari):**
- [ ] Menu appears above input bar
- [ ] Click interactions work
- [ ] Keyboard navigation works (Tab, Enter, ESC)
- [ ] File picker opens correctly
- [ ] Preview cards display properly

## Test 7: Integration Points

**Verify Backend:**
- [ ] Check Railway logs for `/api/file-analysis` requests
- [ ] Verify tier gating works (403 for free tier)
- [ ] Verify model selection (Haiku/Sonnet/Opus) based on tier
- [ ] Verify file analysis completes successfully

**Verify Database:**
- [ ] File uploads saved to Supabase storage
- [ ] File events logged to `file_events` table (if exists)
- [ ] Messages with file attachments saved correctly
- [ ] Analysis responses saved to conversation

## Test 8: Edge Cases

- [ ] Upload multiple files at once
- [ ] Remove file before sending
- [ ] Send message with file but no caption
- [ ] Send message with caption but no file
- [ ] Cancel upload mid-process
- [ ] Switch tiers mid-session (should update menu)

## Known Issues to Watch For

- [ ] Menu not appearing on web (z-index issues)
- [ ] File picker not opening (tier check blocking)
- [ ] Preview icons not showing correctly
- [ ] File analysis returning errors
- [ ] Token tracking not working

## Success Criteria

✅ All tier gating works correctly
✅ File uploads work for supported types
✅ File analysis completes successfully
✅ Error handling is user-friendly
✅ Mobile and desktop both work
✅ No console errors
✅ No broken UI elements

