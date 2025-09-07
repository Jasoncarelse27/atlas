# Atlas AI - Priority Refactoring List
## Based on Component Audit Results

### 🚨 **CRITICAL REFACTORING TARGETS (Over 500 lines)**

These files need immediate attention:

1. **`components/ControlCenter.tsx`** - 1,234 lines ⚠️
   - **Action**: Break into 5-6 smaller components
   - **Priority**: HIGHEST

2. **`components/DashboardTester.tsx`** - 1,241 lines ⚠️
   - **Action**: Extract testing logic into separate components
   - **Priority**: HIGHEST

3. **`components/TestingPanel.tsx`** - 1,210 lines ⚠️
   - **Action**: Split into multiple testing components
   - **Priority**: HIGHEST

4. **`components/Header.tsx`** - 1,113 lines ⚠️
   - **Action**: Extract navigation, user menu, settings
   - **Priority**: HIGH

5. **`components/AccountModal.tsx`** - 927 lines ⚠️
   - **Action**: Split into profile, billing, settings sections
   - **Priority**: HIGH

### 🔥 **HIGH PRIORITY REFACTORING (300-500 lines)**

6. **`features/chat/components/ImageInputArea.tsx`** - 546 lines
   - **Action**: Extract image processing, preview, upload logic
   - **Priority**: HIGH

7. **`hooks/useCustomization.ts`** - 547 lines
   - **Action**: Split into theme, layout, preferences hooks
   - **Priority**: HIGH

8. **`hooks/useSoundEffects.ts`** - 607 lines
   - **Action**: Extract audio management, sound library
   - **Priority**: HIGH

9. **`hooks/useVoiceRecognition.ts`** - 567 lines
   - **Action**: Split into recognition, processing, UI hooks
   - **Priority**: HIGH

10. **`features/chat/components/ConversationHistoryPanel.tsx`** - 573 lines
    - **Action**: Extract conversation list, search, filters
    - **Priority**: HIGH

### 📋 **MEDIUM PRIORITY REFACTORING (200-300 lines)**

11. **`App.tsx`** - 613 lines
    - **Action**: Extract routing, providers, main layout
    - **Priority**: MEDIUM

12. **`components/WidgetSystem.tsx`** - 764 lines
    - **Action**: Split into widget types, management, rendering
    - **Priority**: MEDIUM

13. **`components/NetworkCheckModal.tsx`** - 782 lines
    - **Action**: Extract network tests, diagnostics, results
    - **Priority**: MEDIUM

14. **`components/UpgradeModal.tsx`** - 719 lines
    - **Action**: Split into pricing, features, billing sections
    - **Priority**: MEDIUM

---

## 🎯 **TODAY'S REFACTORING PLAN**

### **Phase 1: Critical Components (2 hours)**
Focus on the 1,000+ line monsters:

1. **ControlCenter.tsx** → Split into:
   - `ControlCenterHeader.tsx`
   - `ControlCenterSettings.tsx`
   - `ControlCenterActions.tsx`
   - `ControlCenterStatus.tsx`

2. **DashboardTester.tsx** → Split into:
   - `TestRunner.tsx`
   - `TestResults.tsx`
   - `TestConfiguration.tsx`

### **Phase 2: High Priority (2 hours)**
3. **Header.tsx** → Split into:
   - `HeaderNavigation.tsx`
   - `HeaderUserMenu.tsx`
   - `HeaderSettings.tsx`

4. **ImageInputArea.tsx** → Split into:
   - `ImageUploader.tsx`
   - `ImagePreview.tsx`
   - `ImageProcessor.tsx`

### **Phase 3: Service Layer (1 hour)**
5. Standardize error handling across all services
6. Add retry logic with exponential backoff
7. Create service interfaces

---

## 🛠️ **REFACTORING TEMPLATE**

For each large component, follow this pattern:

```typescript
// 1. Extract interfaces
interface ComponentProps {
  // Define clear props
}

// 2. Split into smaller components
const ComponentHeader = ({ ... }) => { ... };
const ComponentBody = ({ ... }) => { ... };
const ComponentFooter = ({ ... }) => { ... };

// 3. Main component becomes orchestrator
const MainComponent = ({ ... }: ComponentProps) => {
  return (
    <div>
      <ComponentHeader {...headerProps} />
      <ComponentBody {...bodyProps} />
      <ComponentFooter {...footerProps} />
    </div>
  );
};
```

---

## 📊 **SUCCESS METRICS**

- **Target**: No files over 300 lines
- **Current**: 67 files over 200 lines
- **Goal**: Reduce to under 20 files over 200 lines

---

## 🚀 **IMMEDIATE ACTION**

Let's start with **ControlCenter.tsx** - the largest file at 1,234 lines.

**Ready to begin refactoring?** 🎯
