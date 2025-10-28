# E2E Tests with Playwright

## 📁 Test Structure

```
tests/e2e/
├── smoke.spec.ts                   # Quick sanity checks
├── ritual-journey.spec.ts          # Complete user journeys
└── mobile-gestures.spec.ts         # Mobile-specific interactions
```

## 🚀 Running Tests

### Run All E2E Tests
```bash
npx playwright test
```

### Run Specific Test File
```bash
npx playwright test ritual-journey.spec.ts
```

### Run in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Run Only Mobile Tests
```bash
npx playwright test --project="Mobile Chrome"
```

### Run Only Desktop Tests
```bash
npx playwright test --project="chromium"
```

## 🧪 Test Categories

### **Smoke Tests** (`smoke.spec.ts`)
**Purpose**: Fast sanity checks  
**Runtime**: ~10 seconds  
**Coverage**:
- Homepage loads
- Core pages accessible
- No console errors
- Responsive across viewports

### **Ritual Journey Tests** (`ritual-journey.spec.ts`)
**Purpose**: End-to-end user flows  
**Runtime**: ~2 minutes  
**Coverage**:
- Browse ritual library
- View ritual details
- Start and complete ritual
- Create custom ritual
- View statistics
- Filter and search
- Tier enforcement

### **Mobile Gesture Tests** (`mobile-gestures.spec.ts`)
**Purpose**: Touch interactions  
**Runtime**: ~3 minutes  
**Coverage**:
- Swipe gestures
- Touch targets (48px minimum)
- Pull-to-refresh
- Bottom sheets
- Landscape mode
- Drag and drop
- Haptic feedback (indirect)

## 📊 Projects (Browsers)

Tests run across 5 configurations:
- ✅ **Desktop Chrome** (Chromium)
- ✅ **Desktop Firefox**
- ✅ **Desktop Safari** (WebKit)
- 📱 **Mobile Chrome** (Pixel 5)
- 📱 **Mobile Safari** (iPhone 12)

## 🎯 Test Data

### Using `data-testid` Attributes
Tests rely on `data-testid` attributes for stable selectors:

```tsx
// In component
<div data-testid="ritual-card">...</div>

// In test
await page.click('[data-testid="ritual-card"]');
```

### Required Test IDs
Add these to components for full E2E coverage:

**Ritual Library**:
- `ritual-card` - Ritual cards
- `ritual-title` - Ritual title
- `ritual-steps` - Step list
- `search-input` - Search box
- `filter-goal` - Goal filter
- `sort-select` - Sort dropdown
- `fab-create-ritual` - Floating action button

**Ritual Run**:
- `step-content` - Current step
- `step-indicator` - Step number (e.g., "1 of 5")
- `timer` - Countdown timer
- `mood-selector` - Mood selection

**Ritual Builder**:
- `step-card` - Step in builder
- `step-title` - Step title input
- `step-duration` - Duration input
- `drag-handle` - Drag handle for reordering
- `step-config-sheet` - Mobile bottom sheet

**General**:
- `upgrade-modal` - Tier upgrade prompt
- `bottom-sheet` - Generic bottom sheet
- `bottom-sheet-backdrop` - Bottom sheet backdrop
- `refresh-indicator` - Pull-to-refresh spinner

## 🐛 Debugging

### View Test Reports
```bash
npx playwright show-report
```

### Generate Trace
```bash
npx playwright test --trace on
```

### Debug Mode (Step Through)
```bash
npx playwright test --debug
```

### Take Screenshots on Failure
```typescript
test('example', async ({ page }) => {
  await page.screenshot({ path: 'screenshot.png' });
});
```

## ⚡ Best Practices

### ✅ DO
- Use `data-testid` for selectors
- Wait for elements with `waitForSelector`
- Use `expect` assertions liberally
- Test critical paths first
- Run smoke tests before full suite

### ❌ DON'T
- Don't use brittle selectors (CSS classes)
- Don't hardcode delays (`waitForTimeout` sparingly)
- Don't test external services
- Don't run all browsers in local dev (CI/CD only)

## 🔄 CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## 📈 Coverage Goals

| Test Category | Target Coverage |
|--------------|-----------------|
| Smoke Tests | 100% (all pages load) |
| Critical Paths | 80% (core user journeys) |
| Mobile Gestures | 60% (key interactions) |
| Edge Cases | 40% (nice-to-have) |

## 🚧 Known Limitations

1. **Authentication**: Tests assume user is logged in or anonymous access is enabled
2. **Haptic Feedback**: Can't directly test vibration, only verify code is called
3. **Real Database**: Tests may create test data (cleanup needed)
4. **Network Requests**: Some tests may hit real APIs (consider mocking)

## 📝 Adding New Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('New Feature', () => {
  test('does something', async ({ page }) => {
    // 1. Navigate
    await page.goto('/path');
    
    // 2. Interact
    await page.click('[data-testid="button"]');
    
    // 3. Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

## 🔗 Resources

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
- [Mobile Testing](https://playwright.dev/docs/emulation)

---

**Last Updated**: 2025-10-28  
**Test Count**: 30+ E2E tests  
**Browsers**: 5 (Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari)

