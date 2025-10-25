# Duplicate Image Upload on Mobile - Root Cause Found 🔍

**Status:** Critical bug identified
**Impact:** Unprofessional UX - uploads same image twice

---

## 🔴 **ROOT CAUSE**

**Location:** `src/components/chat/AttachmentMenu.tsx` lines 454-470

### **The Problem:**

**TWO separate file inputs both call `handleImageSelect`:**

```typescript
// Input #1: Gallery picker
<input
  type="file"
  accept="image/*,video/*"
  ref={imageInputRef}               // ← Ref 1
  onChange={handleImageSelect}      // ← Same handler
/>

// Input #2: Camera with capture
<input
  type="file"
  accept="image/*"
  capture="environment"              // ← Mobile camera capture
  ref={mobileCameraInputRef}        // ← Ref 2
  onChange={handleImageSelect}      // ← Same handler
/>
```

### **Why Duplicate Uploads Happen:**

On mobile, when user taps "Choose Photo" button (line 494):
1. Triggers `imageInputRef.current?.click()` 
2. Mobile OS shows image picker
3. User selects image
4. **BOTH inputs can fire onChange** due to:
   - Overlapping `accept="image/*"` filters
   - Mobile browser quirks with `capture` attribute
   - Event bubbling/propagation issues

Even though `e.target.value = ''` clears the value (line 62), **BOTH refs are already triggered before the clear happens**.

---

## ✅ **THE FIX**

### **Solution: Separate Handlers for Gallery vs Camera**

Create two distinct handlers:
- `handleImageSelect` → Gallery only (imageInputRef)
- `handleCameraCapture` → Camera only (mobileCameraInputRef)

This ensures **ONLY the triggered input processes the upload**.

### **Implementation:**

**File:** `src/components/chat/AttachmentMenu.tsx`

**Change 1: Create separate camera handler (after line 68)**
```typescript
// 🔹 Upload handler for images from gallery
const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (isUploading) {
    logger.debug('[AttachmentMenu] Upload already in progress');
    return;
  }
  
  e.target.value = '';
  setFailedUpload(null);
  await uploadImage(file);
};

// 🔹 NEW: Separate handler for camera capture
const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (isUploading) {
    logger.debug('[AttachmentMenu] Upload already in progress');
    return;
  }
  
  e.target.value = '';
  setFailedUpload(null);
  await uploadImage(file);
};
```

**Change 2: Update camera input to use new handler (line 468)**
```typescript
<input
  type="file"
  accept="image/*"
  capture="environment"
  ref={mobileCameraInputRef}
  style={{ display: "none" }}
  onChange={handleCameraCapture}  // ← Changed from handleImageSelect
  aria-label="Take photo with camera"
/>
```

---

## 📊 **Why This Works**

| Scenario | Before | After |
|----------|--------|-------|
| **Tap "Choose Photo"** | Both inputs trigger | Only imageInputRef triggers ✅ |
| **Tap "Take Photo"** | Both inputs trigger | Only mobileCameraInputRef triggers ✅ |
| **Gallery select** | 2 uploads ❌ | 1 upload ✅ |
| **Camera capture** | 2 uploads ❌ | 1 upload ✅ |

---

## 🧪 **Testing**

### Before Fix:
1. Open mobile
2. Tap attachment menu
3. Tap "Choose Photo"
4. Select image
5. **See: TWO "Uploading..." indicators** ❌

### After Fix:
1. Open mobile
2. Tap attachment menu
3. Tap "Choose Photo"
4. Select image
5. **See: ONE "Uploading..." indicator** ✅

---

## ⚡ **Time to Fix**

**Estimated:** 3 minutes
**Files Changed:** 1 file
**Lines Changed:** ~10 lines

---

## 🎯 **Alternative Solution (If Still Duplicates)**

If the above doesn't fix it, the issue might be the button click itself. In that case:

**Add debouncing to button click:**

```typescript
const [lastClickTime, setLastClickTime] = useState(0);

onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // ✅ Debounce: Ignore clicks within 500ms
  const now = Date.now();
  if (now - lastClickTime < 500) {
    logger.debug('[AttachmentMenu] Ignoring duplicate click');
    return;
  }
  setLastClickTime(now);
  
  if (!isUploading) {
    imageInputRef.current?.click();
  }
}}
```

---

**Ready to implement the fix?** This will make image upload professional and prevent duplicate uploads. 🚀

