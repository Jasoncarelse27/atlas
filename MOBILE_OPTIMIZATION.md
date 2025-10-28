# 📱 Atlas Mobile Optimization Guide

Complete documentation for Atlas's mobile-first features and best practices.

---

## 🎯 **Overview**

Atlas is a **Progressive Web App (PWA)** optimized for mobile browsers with native-like interactions. It provides an excellent mobile experience without requiring app store distribution.

### **Key Mobile Features**

- ✅ **Responsive Design**: Adapts to all screen sizes (320px - 2560px)
- ✅ **Touch-Optimized**: Large touch targets (48px minimum, 120px optimal)
- ✅ **Haptic Feedback**: Vibration feedback for key interactions
- ✅ **Swipe Gestures**: Natural mobile navigation patterns
- ✅ **Pull-to-Refresh**: Standard mobile refresh interaction
- ✅ **Bottom Sheets**: Native-like modal presentation
- ✅ **Offline Support**: Service worker caching for offline access
- ✅ **Install Prompt**: Add to home screen functionality

---

## 🏗️ **Architecture**

### **Core Hook: `useMobileOptimization`**

Location: `src/hooks/useMobileOptimization.ts`

Centralized hook for all mobile-specific features and device detection.

```typescript
import { useMobileOptimization } from '@/hooks/useMobileOptimization';

function MyComponent() {
  const {
    isMobile,
    isTablet,
    isLandscape,
    triggerHaptic,
    shareContent,
    installPWA,
  } = useMobileOptimization();

  const handleAction = () => {
    triggerHaptic(10); // 10ms vibration
    // ... perform action
  };

  return (
    <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
      {/* ... */}
    </div>
  );
}
```

### **Available Features**

| Feature | Method | Description |
|---------|--------|-------------|
| **Device Detection** | `isMobile`, `isTablet` | Responsive breakpoint detection |
| **Orientation** | `isLandscape` | Device orientation |
| **Haptic Feedback** | `triggerHaptic(duration)` | Vibration feedback |
| **Native Share** | `shareContent(data)` | Web Share API |
| **PWA Install** | `installPWA()` | Trigger install prompt |
| **Camera Access** | `getCameraAccess()` | Request camera permission |
| **Microphone Access** | `getMicrophoneAccess()` | Request microphone permission |

---

## 🎨 **Responsive Design System**

### **Breakpoints**

Atlas uses standard Tailwind CSS breakpoints:

| Breakpoint | Min Width | Target Devices |
|------------|-----------|----------------|
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops, small desktops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

### **Mobile-First Approach**

```tsx
// ✅ GOOD: Mobile-first (default is mobile)
<div className="flex-col md:flex-row gap-2 md:gap-4">
  {/* Mobile: column, small gap */}
  {/* Desktop: row, large gap */}
</div>

// ❌ BAD: Desktop-first
<div className="flex-row lg:flex-col">
  {/* Harder to maintain */}
</div>
```

---

## 👆 **Touch Optimization**

### **Touch Target Sizes**

Atlas follows **Apple HIG** and **Material Design** guidelines:

| Platform | Minimum | Recommended | Atlas Standard |
|----------|---------|-------------|----------------|
| **iOS** | 44px × 44px | 48px × 48px | 48px |
| **Android** | 48dp × 48dp | 48dp × 48dp | 48dp |
| **Atlas Cards** | - | - | **120px min-height** |

### **Implementation**

```tsx
// Button with proper touch target
<button className="min-h-[48px] min-w-[48px] touch-manipulation active:scale-95">
  Click Me
</button>

// Card with large touch area
<div className="min-h-[120px] touch-manipulation hover:shadow-lg active:scale-[0.98]">
  {/* Card content */}
</div>
```

### **CSS Classes for Touch**

- `touch-manipulation` - Prevents double-tap zoom on buttons
- `active:scale-95` - Visual feedback on tap
- `active:scale-[0.98]` - Subtle feedback for cards

---

## 🤚 **Gesture Support**

### **1. Swipe Gestures**

Used in: `RitualRunView` for step navigation

```typescript
const [touchStart, setTouchStart] = useState(0);
const [touchEnd, setTouchEnd] = useState(0);

const handleTouchStart = (e: React.TouchEvent) => {
  setTouchStart(e.targetTouches[0].clientX);
};

const handleTouchMove = (e: React.TouchEvent) => {
  setTouchEnd(e.targetTouches[0].clientX);
};

const handleTouchEnd = () => {
  const swipeDistance = touchStart - touchEnd;
  const minSwipeDistance = 50;

  if (swipeDistance > minSwipeDistance) {
    // Swipe left - next step
    handleNext();
  } else if (swipeDistance < -minSwipeDistance) {
    // Swipe right - previous step
    handlePrevious();
  }
};

return (
  <div
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
  >
    {/* Swipeable content */}
  </div>
);
```

### **2. Pull-to-Refresh**

Used in: `RitualLibrary` for refreshing ritual list

```typescript
const [pullDistance, setPullDistance] = useState(0);
const [isRefreshing, setIsRefreshing] = useState(false);

const handleTouchStart = (e: React.TouchEvent) => {
  setStartY(e.touches[0].clientY);
};

const handleTouchMove = (e: React.TouchEvent) => {
  if (containerRef.current?.scrollTop === 0) {
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    setPullDistance(Math.max(0, distance));
  }
};

const handleTouchEnd = () => {
  if (pullDistance > 80) {
    setIsRefreshing(true);
    await fetchRituals();
    setIsRefreshing(false);
  }
  setPullDistance(0);
};
```

### **3. Drag-and-Drop (Touch Support)**

Used in: `RitualBuilder` for reordering steps

```typescript
import { TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';

const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { distance: 10 }
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 }
  })
);

return (
  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    {/* Draggable items */}
  </DndContext>
);
```

---

## 📲 **Bottom Sheets**

Native-like modal presentation for mobile devices.

### **When to Use**

- ✅ Configuration panels on mobile
- ✅ Action sheets with multiple options
- ✅ Preview screens for locked features
- ❌ Full-screen forms (use modal instead)

### **Implementation**

```tsx
{isMobile && showSheet && (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-end"
    onClick={() => setShowSheet(false)}
  >
    <div
      className="bg-white rounded-t-xl p-4 w-full max-h-[80vh] overflow-y-auto animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sheet content */}
    </div>
  </div>
)}
```

---

## 📳 **Haptic Feedback**

### **When to Use Haptics**

| Action | Duration | When |
|--------|----------|------|
| **Button Tap** | 10ms | Confirmation of interaction |
| **Success** | 20ms | Completed action |
| **Error** | 50ms | Failed validation |
| **Drag Start** | 10ms | Beginning of drag |
| **Drag End** | 10ms | End of drag/drop |
| **Delete** | 30ms | Destructive action |

### **Implementation**

```typescript
const { triggerHaptic } = useMobileOptimization();

// Button tap
const handleClick = () => {
  triggerHaptic(10);
  performAction();
};

// Success
const handleSuccess = () => {
  triggerHaptic(20);
  showSuccessToast();
};

// Error
const handleError = () => {
  triggerHaptic(50);
  showErrorToast();
};
```

### **Browser Support**

- ✅ Chrome Android
- ✅ Samsung Internet
- ✅ Firefox Android
- ❌ iOS Safari (requires WebKit API)

---

## 🎭 **Orientation Support**

### **Landscape Mode Optimizations**

Used in: `RitualRunView` timer display

```typescript
const { isLandscape } = useMobileOptimization();

return (
  <div className={isLandscape ? 'flex-row justify-around' : 'flex-col'}>
    {/* Landscape: side-by-side */}
    {/* Portrait: stacked */}
  </div>
);
```

### **Responsive Text Scaling**

```tsx
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
  {/* Scales appropriately for viewport */}
</h1>
```

---

## 🔌 **PWA Features**

### **Service Worker**

Location: `public/sw.js`

```javascript
// Cache strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### **App Manifest**

Location: `public/manifest.json`

```json
{
  "name": "Atlas - Emotional Intelligence AI",
  "short_name": "Atlas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### **Install Prompt**

```typescript
const { installPWA, canInstall } = useMobileOptimization();

{canInstall && (
  <button onClick={installPWA} className="btn-primary">
    Install App
  </button>
)}
```

---

## 🧪 **Testing Mobile Features**

### **Manual Testing Checklist**

See: [MOBILE_TEST_CHECKLIST.md](./MOBILE_TEST_CHECKLIST.md)

### **Integration Tests**

Location: `src/features/rituals/__tests__/integration/ritual-mobile.integration.test.ts`

```typescript
beforeEach(() => {
  // Simulate mobile environment
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    configurable: true,
  });
  
  // Set mobile viewport
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 375,
  });
});
```

### **E2E Tests**

Location: `tests/e2e/mobile-gestures.spec.ts`

```typescript
test('swipe gesture navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  
  const stepCard = page.locator('[data-testid="ritual-step"]').first();
  const box = await stepCard.boundingBox();
  
  // Simulate swipe left
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  
  // Verify navigation
  await expect(page.locator('[data-testid="step-indicator"]')).toContainText('2');
});
```

---

## 📊 **Performance Optimization**

### **Mobile-Specific Optimizations**

1. **Lazy Loading**
   - Images lazy load below fold
   - Components lazy load via `React.lazy()`

2. **Code Splitting**
   - Route-based splitting
   - Heavy components split separately

3. **Image Optimization**
   - WebP format with fallbacks
   - Responsive images with `srcset`

4. **Touch Event Optimization**
   - Use `passive: true` for scroll listeners
   - Debounce expensive gesture handlers

### **Performance Budgets**

| Metric | Target | Max |
|--------|--------|-----|
| **FCP** | < 1.5s | 2s |
| **LCP** | < 2.5s | 3s |
| **TTI** | < 3.5s | 5s |
| **CLS** | < 0.1 | 0.25 |

---

## 🎨 **Mobile UI Components**

### **Optimized Components**

1. **RitualLibrary** - Pull-to-refresh, bottom sheets, FAB
2. **RitualRunView** - Swipe navigation, haptic feedback
3. **RitualBuilder** - Touch drag-and-drop, mobile config panel
4. **RitualStepCard** - 120px touch target, scale feedback

### **Mobile-First Patterns**

```tsx
// Floating Action Button (FAB)
<button className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-blue-500 rounded-full shadow-lg">
  <Plus className="h-6 w-6 text-white" />
</button>

// Bottom Navigation
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2">
  {/* Navigation items */}
</nav>

// Card with tap feedback
<div className="p-4 bg-white rounded-lg shadow hover:shadow-lg active:scale-[0.98] transition-all">
  {/* Card content */}
</div>
```

---

## 📝 **Best Practices**

### **DO**

- ✅ Use `touch-manipulation` on interactive elements
- ✅ Provide haptic feedback for important actions
- ✅ Use bottom sheets instead of modals on mobile
- ✅ Test on real devices (iOS Safari, Chrome Android)
- ✅ Support landscape orientation for video/timers
- ✅ Use large, clear typography (16px minimum)

### **DON'T**

- ❌ Use hover states as primary interaction
- ❌ Make touch targets smaller than 48px
- ❌ Block scrolling unnecessarily
- ❌ Use complex gestures without alternatives
- ❌ Ignore device orientation changes
- ❌ Use tiny fonts (< 14px)

---

## 🐛 **Common Issues & Solutions**

### **Issue: 300ms Tap Delay**
**Solution:** Add `touch-manipulation` CSS class
```tsx
<button className="touch-manipulation">Fast Tap</button>
```

### **Issue: Zoom on Input Focus (iOS)**
**Solution:** Set font size to 16px or larger
```css
input {
  font-size: 16px;
}
```

### **Issue: Scroll Janking**
**Solution:** Use `passive` event listeners
```typescript
element.addEventListener('touchstart', handler, { passive: true });
```

### **Issue: Bottom Sheet Under Keyboard**
**Solution:** Use `viewport-fit=cover` and safe area insets
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
```css
padding-bottom: env(safe-area-inset-bottom);
```

---

## 📚 **References**

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Touch Targets](https://m3.material.io/foundations/interaction/states/overview)
- [MDN Web Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)
- [PWA Builder](https://www.pwabuilder.com/)

---

**Built with ❤️ for mobile-first experiences**

