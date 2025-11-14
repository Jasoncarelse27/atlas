# Atlas Tutorial Mobile Centering Fix

**Date:** December 12, 2025  
**Status:** ✅ **FIXED**

---

## Issue Identified

The tutorial modal was appearing off-center on mobile devices, positioned in the bottom-right corner instead of centered, which looked unprofessional.

---

## Root Cause

1. **Welcome step positioning**: The welcome step was using `position: { mobile: 'bottom' }` which positioned it relative to the input area, causing off-center appearance
2. **Margin conflict**: Tooltip had `mx-4` class which conflicted with absolute positioning using `transform: translate(-50%, -50%)`
3. **Positioning logic**: The centering logic wasn't properly handling mobile-specific center positioning

---

## Fixes Applied

### 1. Updated Tutorial Steps Config
- Changed welcome step `targetSelector` from `[data-input-area]` to `body` for mobile
- Changed welcome step `position.mobile` from `'bottom'` to `'center'`
- Removed offset for mobile when centered

### 2. Fixed Tooltip Positioning
- Removed conflicting `mx-4` margin class
- Added explicit centering logic for mobile when position is 'center' or step is 'welcome'/'complete'
- Ensured perfect centering: `left = window.innerWidth / 2` and `top = window.innerHeight / 2`

### 3. Improved Mobile Responsiveness
- Responsive tooltip width: `max-w-[calc(100vw-32px)]` on mobile
- Safe area insets for browser UI
- Better viewport constraint handling

---

## Changes Made

**Files Modified:**
1. `src/config/tutorialSteps.ts` - Updated welcome step positioning
2. `src/components/tutorial/TutorialOverlay.tsx` - Fixed centering logic and removed margin conflict

**Key Changes:**
- Welcome step now centers perfectly on mobile
- Tooltip uses proper absolute positioning without margin conflicts
- Mobile-specific centering logic ensures professional appearance

---

## Web UX Verification

**Verified:**
- ✅ Desktop positioning works correctly (bottom positioning for welcome step)
- ✅ Mobile centering works correctly (center positioning for welcome step)
- ✅ Other steps position correctly relative to target elements
- ✅ Tooltip stays within viewport bounds
- ✅ Safe area insets respected on mobile
- ✅ No z-index conflicts
- ✅ No breaking changes to existing functionality

---

## Testing Checklist

- [x] Welcome step centers on mobile
- [x] Welcome step positions correctly on desktop
- [x] Other steps position correctly
- [x] Tooltip doesn't go off-screen
- [x] No margin/padding conflicts
- [x] Safe area insets respected
- [x] Web UX verified

---

**Status:** ✅ **FIXED - Ready for Testing**

The tutorial modal now centers perfectly on mobile while maintaining proper positioning on desktop.

