# 📱 Mobile Testing Checklist - Atlas Ritual System

## 🎯 Purpose
This checklist ensures comprehensive testing of mobile-optimized features across devices and screen sizes for the Atlas Ritual system.

---

## 📊 Device Matrix

### Required Test Devices
- [ ] **iPhone SE (Small)** - 375x667px, iOS Safari
- [ ] **iPhone 12/13 (Medium)** - 390x844px, iOS Safari  
- [ ] **iPhone 14 Pro Max (Large)** - 430x932px, iOS Safari
- [ ] **Android Galaxy S21 (Medium)** - 360x800px, Chrome
- [ ] **iPad Mini (Tablet)** - 768x1024px, Safari
- [ ] **iPad Pro (Tablet)** - 1024x1366px, Safari

### Browser Requirements
- [ ] iOS Safari (primary)
- [ ] Chrome Mobile (Android)
- [ ] Chrome Desktop (responsive mode)
- [ ] Firefox Mobile

---

## 🧪 Component Test Cases

### **1. RitualRunView - Mobile Optimization**

#### **Portrait Mode**
- [ ] Timer displays at 72px size (readable at arm's length)
- [ ] All buttons are 64-80px touch targets
- [ ] Step indicators are clearly visible
- [ ] Progress bar updates smoothly
- [ ] Mood selection cards are 48px minimum height

#### **Landscape Mode**
- [ ] Timer + controls layout horizontally
- [ ] Progress sidebar appears on left/right
- [ ] No content overflow or scroll issues
- [ ] Buttons remain 64-80px touch targets

#### **Swipe Gestures**
- [ ] Swipe left advances to next step
- [ ] Swipe right goes to previous step
- [ ] Swipe threshold is ~50px
- [ ] No accidental swipes during scrolling
- [ ] Smooth animation on swipe complete

#### **Haptic Feedback**
- [ ] 10ms light haptic on swipe
- [ ] 100ms → 50ms → 100ms pattern on ritual completion
- [ ] 50ms haptic on step advance/back buttons
- [ ] Haptics work on iOS devices (vibrate API)
- [ ] Haptics gracefully fail on unsupported devices

#### **Responsive Breakpoints**
- [ ] Mobile (<768px): Single column, large text
- [ ] Tablet (768-1024px): Two column layout
- [ ] Desktop (>1024px): Three column with sidebar

---

### **2. RitualLibrary - Mobile Optimization**

#### **Pull-to-Refresh**
- [ ] Pull down from top triggers refresh
- [ ] Visual indicator appears during pull (Sparkles icon)
- [ ] Refresh only triggers if scrolled to top
- [ ] 80px threshold before refresh activates
- [ ] Haptic feedback on refresh start and complete
- [ ] Toast notification confirms successful refresh
- [ ] Graceful error handling on network failure

#### **Touch Targets**
- [ ] Ritual cards have 120px minimum height
- [ ] Chat button is 48px touch target
- [ ] Insights button is 48px touch target
- [ ] Create Ritual FAB is 56px diameter
- [ ] All cards have active:scale-[0.98] feedback

#### **Bottom Sheet - Locked Ritual Preview**
- [ ] Opens smoothly from bottom (slide-in animation)
- [ ] 80vh maximum height
- [ ] Scrollable content if exceeds 80vh
- [ ] Handle bar visible at top (12px width, 1.5px height)
- [ ] Close button is 44px minimum touch target
- [ ] Backdrop dimming (black/40% opacity)
- [ ] Tapping backdrop closes sheet
- [ ] Displays ritual steps with truncated instructions
- [ ] Upgrade CTA button is 56px minimum height
- [ ] Smooth close animation

#### **Floating Action Button (Mobile Only)**
- [ ] Visible only on mobile screens (<768px)
- [ ] Fixed position: bottom-6, right-6
- [ ] 56px diameter with "Create" text
- [ ] Shadow: 0 4px 20px rgba(59,54,50,0.3)
- [ ] active:scale-95 feedback on tap
- [ ] Doesn't overlap content (h-24 spacing added)
- [ ] Triggers upgrade modal for free users

#### **Responsive Layout**
- [ ] Mobile: Icon-only buttons in header
- [ ] Desktop: Full text labels on buttons
- [ ] Mobile: Single column card grid
- [ ] Desktop: 3-column card grid (lg breakpoint)
- [ ] Mobile: Floating action button
- [ ] Desktop: Inline "Create Ritual" button

---

### **3. RitualBuilder - Touch Optimization**

#### **Drag Handles**
- [ ] 48px minimum touch target on mobile
- [ ] 24px icon size on mobile (20px desktop)
- [ ] active:scale-110 feedback on grab
- [ ] GripVertical icon clearly visible
- [ ] No accidental drags during scroll

#### **Touch Sensors**
- [ ] TouchSensor activates after 250ms delay
- [ ] 5px movement tolerance before drag starts
- [ ] MouseSensor works on desktop
- [ ] Scrolling doesn't trigger drag
- [ ] Smooth drag animation

#### **Haptic Feedback**
- [ ] 10ms on drag start
- [ ] 50ms on successful reorder
- [ ] 10ms on drag cancel
- [ ] 100ms on delete (destructive action)
- [ ] 50ms on add step
- [ ] 10ms on edit step
- [ ] 50ms on save ritual

#### **Bottom Sheet - Step Config (Mobile)**
- [ ] Opens when tapping step on mobile
- [ ] 85vh maximum height
- [ ] Scrollable content if needed
- [ ] Handle bar visible
- [ ] Close button 44px touch target
- [ ] Backdrop closes sheet
- [ ] Updates step and closes on save
- [ ] Smooth animations (slide-in-from-bottom)

#### **Delete Buttons**
- [ ] Always visible on mobile (opacity-100)
- [ ] Hover-only on desktop (opacity-0 → group-hover:opacity-100)
- [ ] 44px minimum touch target
- [ ] Red color (text-red-500, hover:bg-red-50)
- [ ] Trash2 icon 20px mobile, 18px desktop

#### **Responsive Layout**
- [ ] Mobile: Vertical stack (order-1, order-3)
- [ ] Desktop: 3-column grid (Step Library | Canvas | Config)
- [ ] Mobile: Config panel hidden (bottom sheet instead)
- [ ] Desktop: Sticky config panel (top-4)
- [ ] Mobile: 48px minimum input heights
- [ ] Desktop: Normal input sizes

#### **Form Inputs**
- [ ] Title input: 48px min-height on mobile
- [ ] Goal select: 48px min-height on mobile
- [ ] Focus rings visible (ring-2 ring-[#B2BDA3])
- [ ] Placeholder text readable
- [ ] Save button: 48px min-height, full-width mobile

---

## 🎭 User Experience Flows

### **Flow 1: Complete a Ritual (Mobile)**
1. [ ] Open RitualLibrary on iPhone
2. [ ] Tap a ritual card (120px+ touch target)
3. [ ] Select mood before starting
4. [ ] **Portrait**: Swipe right to go back, swipe left to advance
5. [ ] **Landscape**: Rotate phone, verify horizontal layout
6. [ ] Complete all steps with haptic feedback
7. [ ] Select mood after finishing
8. [ ] See 100-50-100ms completion haptic pattern
9. [ ] Return to library

### **Flow 2: Create Custom Ritual (Mobile)**
1. [ ] Open RitualLibrary on Android
2. [ ] Tap FAB (56px floating button)
3. [ ] Enter ritual title (48px input)
4. [ ] Select goal from dropdown
5. [ ] Tap "Add Step" from step library
6. [ ] Drag steps with 48px handle (250ms delay)
7. [ ] Tap step to open bottom sheet config
8. [ ] Edit duration and instructions
9. [ ] Tap delete button (always visible, 44px)
10. [ ] Save ritual (full-width button, 48px height)
11. [ ] Verify haptic feedback on each action

### **Flow 3: Pull-to-Refresh (Mobile)**
1. [ ] Open RitualLibrary on iPhone
2. [ ] Scroll to absolute top (no scroll position)
3. [ ] Pull down >80px
4. [ ] See Sparkles icon with opacity transition
5. [ ] Feel 50ms haptic on trigger
6. [ ] See "Refreshing..." indicator
7. [ ] Wait for data reload
8. [ ] Feel 100ms success haptic
9. [ ] See "Rituals refreshed" toast

### **Flow 4: Preview Locked Ritual (Mobile)**
1. [ ] Open RitualLibrary as free user
2. [ ] Scroll to "Unlock with Core" section
3. [ ] Tap locked ritual card
4. [ ] Bottom sheet slides up smoothly
5. [ ] See ritual steps (truncated)
6. [ ] See tier badge (Core/Studio)
7. [ ] See duration and step count
8. [ ] Tap "Upgrade to Core" CTA (56px)
9. [ ] Upgrade modal appears
10. [ ] Close modal, bottom sheet still open
11. [ ] Tap backdrop or X to close

---

## 🐛 Edge Cases & Error Scenarios

### **Offline Behavior**
- [ ] Pull-to-refresh shows error toast if offline
- [ ] Cached rituals still displayable
- [ ] Graceful error messages (no crashes)

### **Orientation Changes**
- [ ] Rotate during ritual → layout adapts instantly
- [ ] Timer doesn't reset on orientation change
- [ ] Progress bar updates correctly
- [ ] No layout shift or content clipping

### **Rapid Interactions**
- [ ] Double-tap doesn't trigger action twice
- [ ] Rapid swipes don't skip multiple steps
- [ ] Drag while scrolling doesn't break layout
- [ ] Multiple bottom sheets don't stack

### **Slow Networks**
- [ ] Pull-to-refresh timeout (10s max)
- [ ] Loading states visible
- [ ] Error recovery options

### **Small Screens (iPhone SE)**
- [ ] No horizontal overflow
- [ ] All buttons reachable with one hand
- [ ] Text remains readable (min 14px)
- [ ] Modals don't exceed viewport

---

## ✅ Acceptance Criteria

### **Must Pass (P0)**
- [ ] All touch targets ≥44px Apple HIG minimum
- [ ] Haptic feedback works on iOS
- [ ] No horizontal scroll on mobile
- [ ] All text readable at arm's length
- [ ] Pull-to-refresh functional
- [ ] Bottom sheets open/close smoothly
- [ ] Drag-and-drop works on touch devices

### **Should Pass (P1)**
- [ ] Landscape mode layouts correctly
- [ ] FAB doesn't obscure content
- [ ] Swipe gestures feel natural
- [ ] Haptic patterns enhance UX (not annoying)
- [ ] Responsive breakpoints smooth

### **Nice to Have (P2)**
- [ ] Pull-to-refresh <100ms response
- [ ] Drag activation <250ms
- [ ] All animations 60fps
- [ ] Zero layout shift on load

---

## 📝 Test Execution Log

| Date | Tester | Device | Pass/Fail | Notes |
|------|--------|--------|-----------|-------|
| YYYY-MM-DD | Name | iPhone 13 | ⏳ Pending | |
| YYYY-MM-DD | Name | Galaxy S21 | ⏳ Pending | |
| YYYY-MM-DD | Name | iPad Pro | ⏳ Pending | |

---

## 🚀 Automation Opportunities

### **Playwright Mobile Tests (Future)**
- [ ] Mobile viewport emulation (390x844, 375x667)
- [ ] Touch event simulation
- [ ] Orientation change tests
- [ ] Pull-to-refresh automation
- [ ] Bottom sheet open/close
- [ ] Drag-and-drop touch simulation

### **Lighthouse Mobile Audits**
- [ ] Performance score ≥90
- [ ] Accessibility score 100
- [ ] Touch target sizes pass
- [ ] Tap targets not too close (<8px spacing)

---

## 📚 References

- **Apple HIG**: https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/adaptivity-and-layout/
- **Material Design Touch Targets**: https://material.io/design/usability/accessibility.html#layout-typography
- **MDN Touch Events**: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
- **Vibration API**: https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API

---

**Last Updated**: 2025-10-28  
**Version**: 1.0  
**Owner**: @jasoncarelse  
**Status**: ⏳ Ready for Testing

