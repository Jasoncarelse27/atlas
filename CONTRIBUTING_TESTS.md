# 🧪 Testing Guide for Atlas Contributors

Complete guide for writing and running tests in the Atlas codebase.

---

## 📋 **Quick Start**

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test src/services/__tests__/fastspringService.test.ts

# Run with coverage
npm test -- --coverage
```

---

## 🏗️ **Testing Architecture**

Atlas uses a **hybrid testing strategy** combining unit tests, integration tests, and E2E tests.

### **Test Types Overview**

| Test Type | Tool | Speed | When to Use |
|-----------|------|-------|-------------|
| **Unit Tests** | Vitest | ⚡ Fast | Business logic, calculations, hooks |
| **Integration Tests** | Vitest + Real DB | 🐢 Slower | Database operations, API flows |
| **E2E Tests** | Playwright | 🐢🐢 Slowest | User journeys, critical flows |

---

## ✅ **Unit Tests**

### **Setup**

- **Framework**: Vitest
- **Test Environment**: jsdom (simulates browser)
- **Mock Library**: Vitest built-in mocks
- **Testing Library**: @testing-library/react

### **File Structure**

```
src/
├── services/
│   ├── fastspringService.ts
│   └── __tests__/
│       └── fastspringService.test.ts
├── hooks/
│   ├── useMobileOptimization.ts
│   └── __tests__/
│       └── useMobileOptimization.test.ts
└── components/
    ├── ErrorBoundary.tsx
    └── __tests__/
        └── ErrorBoundary.test.tsx
```

### **Writing Unit Tests**

#### **1. Basic Test Structure**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myFunction } from '../myFunction';

describe('MyFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });

  it('should handle edge case', () => {
    const result = myFunction(edgeCase);
    expect(result).toBe(expectedEdge);
  });
});
```

#### **2. Testing React Components**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle click', async () => {
    const user = userEvent.setup();
    const onClickMock = vi.fn();
    
    render(<MyComponent onClick={onClickMock} />);
    
    await user.click(screen.getByRole('button'));
    
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});
```

#### **3. Testing Hooks**

```typescript
import { renderHook } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useMyHook());
    
    expect(result.current.value).toBe(0);
  });

  it('should update state', () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.value).toBe(1);
  });
});
```

### **Centralized Mocking**

Atlas uses centralized mocks for consistency. Always import from `@/test/mocks/`:

```typescript
import { resetMocks, setMockData, setMockError } from '@/test/mocks/supabase';

describe('My Service', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should fetch data', async () => {
    setMockData([{ id: 1, name: 'Test' }]);
    
    const result = await myService.fetchData();
    
    expect(result).toEqual([{ id: 1, name: 'Test' }]);
  });

  it('should handle errors', async () => {
    setMockError({ message: 'Database error' });
    
    const result = await myService.fetchData();
    
    expect(result).toEqual([]);
  });
});
```

### **Available Mocks**

- **Supabase Client**: `@/test/mocks/supabase`
- **Logger**: Auto-mocked in setup
- **Browser APIs**: Auto-mocked in `src/test/setup.ts`

---

## 🔗 **Integration Tests**

### **Setup**

Integration tests use a **real Supabase test database** for high confidence.

#### **Environment Variables**

Create `.env.test`:
```bash
VITE_SUPABASE_TEST_URL=https://your-test-project.supabase.co
VITE_SUPABASE_TEST_KEY=your-test-anon-key
```

#### **Test Database Setup**

1. Create a separate Supabase project for testing
2. Apply the same migrations as production
3. Use RLS policies to isolate test data

### **Writing Integration Tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import { ritualService } from '../ritualService';

// Only run if test DB is configured
const useRealDB = !!import.meta.env.VITE_SUPABASE_TEST_URL;

describe.skipIf(!useRealDB)('Ritual Service Integration', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const { data } = await supabase.auth.signUp({
      email: `test-${Date.now()}@atlas.test`,
      password: 'TestPassword123!'
    });
    testUserId = data.user!.id;
  });

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('rituals').delete().eq('user_id', testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
  });

  it('should create and fetch ritual', async () => {
    const ritual = await ritualService.createRitual({
      title: 'Test Ritual',
      goal: 'calm',
      steps: []
    });

    expect(ritual.id).toBeDefined();

    const fetched = await ritualService.getRitual(ritual.id);
    expect(fetched.title).toBe('Test Ritual');
  });
});
```

### **Conditional Execution**

Integration tests automatically skip if no test database is configured:

```typescript
describe.skipIf(!useRealDB)('Integration Tests', () => {
  // Tests here only run if VITE_SUPABASE_TEST_URL is set
});
```

---

## 🎭 **E2E Tests (Playwright)**

### **Setup**

```bash
# Install Playwright (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e -- --ui

# Run specific browser
npm run test:e2e -- --project=chromium
```

### **File Structure**

```
tests/
├── e2e/
│   ├── ritual-journey.spec.ts
│   ├── mobile-gestures.spec.ts
│   └── smoke.spec.ts
└── playwright.config.ts
```

### **Writing E2E Tests**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Ritual Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Login (if needed)
    await page.fill('[data-testid="email"]', 'test@atlas.test');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-btn"]');
  });

  test('should complete ritual flow', async ({ page }) => {
    // Navigate to rituals
    await page.click('[data-testid="rituals-tab"]');
    
    // Select a ritual
    await page.click('[data-testid="ritual-card"]').first();
    
    // Start ritual
    await page.click('[data-testid="start-ritual-btn"]');
    
    // Complete steps
    await page.click('[data-testid="next-step-btn"]');
    await page.click('[data-testid="complete-ritual-btn"]');
    
    // Verify completion
    await expect(page.locator('[data-testid="completion-message"]'))
      .toBeVisible();
  });
});
```

### **Mobile E2E Tests**

```typescript
test('mobile swipe gesture', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  const card = page.locator('[data-testid="ritual-step"]').first();
  const box = await card.boundingBox();
  
  // Simulate swipe left
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  
  // Verify navigation
  await expect(page.locator('[data-testid="step-2"]')).toBeVisible();
});
```

---

## 🎯 **Test Best Practices**

### **DO**

✅ **Use data-testid for stable selectors**
```typescript
<button data-testid="submit-btn">Submit</button>

// In test
screen.getByTestId('submit-btn')
```

✅ **Test user behavior, not implementation**
```typescript
// Good: Tests what user sees
await user.click(screen.getByRole('button', { name: /submit/i }));

// Bad: Tests implementation details
expect(component.state.isSubmitting).toBe(true);
```

✅ **Use descriptive test names**
```typescript
it('should show error message when email is invalid', () => {
  // Clear what's being tested
});
```

✅ **Clean up after tests**
```typescript
afterEach(async () => {
  await cleanupTestData();
});
```

✅ **Mock external services**
```typescript
vi.mock('@/services/externalApi', () => ({
  callApi: vi.fn().mockResolvedValue({ success: true })
}));
```

### **DON'T**

❌ **Don't test implementation details**
```typescript
// Bad
expect(wrapper.find('.internal-class')).toExist();

// Good
expect(screen.getByText('Expected Output')).toBeInTheDocument();
```

❌ **Don't use brittle selectors**
```typescript
// Bad: Breaks if styling changes
page.locator('.bg-blue-500.rounded-lg')

// Good: Stable test ID
page.locator('[data-testid="submit-btn"]')
```

❌ **Don't skip cleanup**
```typescript
// Bad: Leaves test data in database
it('creates user', async () => {
  await createUser('test@example.com');
  // No cleanup!
});
```

❌ **Don't test libraries**
```typescript
// Bad: Testing React's useState
it('useState works', () => {
  const [count, setCount] = useState(0);
  setCount(1);
  expect(count).toBe(1);
});
```

---

## 📊 **Test Coverage**

### **Check Coverage**

```bash
npm test -- --coverage
```

### **Coverage Goals**

| Category | Target | Current |
|----------|--------|---------|
| **Statements** | > 80% | TBD |
| **Branches** | > 75% | TBD |
| **Functions** | > 80% | TBD |
| **Lines** | > 80% | TBD |

### **What to Cover**

✅ **High Priority**
- Business logic (services, utilities)
- Critical user flows (auth, payments)
- Error handling paths
- Tier enforcement logic

⚠️ **Medium Priority**
- UI components
- Hooks
- Edge cases

❌ **Low Priority**
- Type definitions
- Constants
- Simple mappers

---

## 🐛 **Debugging Tests**

### **Vitest Debugging**

```bash
# Run single test file
npm test src/services/__tests__/myService.test.ts

# Run with UI
npm test -- --ui

# Watch mode
npm test -- --watch

# Verbose output
npm test -- --reporter=verbose
```

### **Playwright Debugging**

```bash
# Debug mode (opens browser)
npm run test:e2e -- --debug

# Headed mode (see browser)
npm run test:e2e -- --headed

# Trace on failure
npm run test:e2e -- --trace on
```

### **Common Issues**

#### **Issue: Mock not working**
```typescript
// Solution: Import mock before the module
vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase
}));

import { myService } from '../myService'; // After mock
```

#### **Issue: Async test timing out**
```typescript
// Solution: Increase timeout or use waitFor
it('async test', async () => {
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  }, { timeout: 5000 });
});
```

#### **Issue: Component not rendering**
```typescript
// Solution: Wrap in necessary providers
render(
  <MemoryRouter>
    <QueryClientProvider client={queryClient}>
      <MyComponent />
    </QueryClientProvider>
  </MemoryRouter>
);
```

---

## 🚀 **CI/CD Integration**

### **Pre-Commit Hooks**

Tests run automatically before commits:
```bash
# Defined in .husky/pre-commit
npm run lint
npm run typecheck
npm test -- --run
```

### **GitHub Actions**

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run test:e2e
```

---

## 📚 **Resources**

### **Documentation**
- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Docs](https://playwright.dev/)
- [Atlas Testing Strategy](./TESTING_STRATEGY.md)

### **Examples**
- Unit Tests: `src/services/__tests__/fastspringService.test.ts`
- Integration Tests: `src/features/rituals/__tests__/integration/`
- E2E Tests: `tests/e2e/ritual-journey.spec.ts`

### **Helpful Commands**

```bash
# Full test suite
npm test -- --run

# Only unit tests
npm test src/ -- --run

# Only integration tests
npm test src/features/rituals/__tests__/integration/

# Only E2E tests
npm run test:e2e

# Update snapshots
npm test -- -u

# Run tests matching pattern
npm test -- --grep "ritual"
```

---

## 🤝 **Contributing Tests**

### **Pull Request Checklist**

- [ ] All existing tests pass
- [ ] New features have unit tests
- [ ] Critical flows have integration tests
- [ ] User journeys have E2E tests
- [ ] No console errors in tests
- [ ] Coverage hasn't decreased

### **Test Naming Convention**

```typescript
describe('ServiceName', () => {
  describe('methodName()', () => {
    it('should do expected behavior when condition', () => {
      // Test implementation
    });

    it('should handle error when invalid input', () => {
      // Error handling test
    });
  });
});
```

---

## 💡 **Tips & Tricks**

### **Speed Up Tests**

1. Use `it.skip()` to skip slow tests during development
2. Use `describe.only()` to focus on specific tests
3. Mock heavy dependencies
4. Use `beforeAll` for expensive setup

### **Reduce Flakiness**

1. Use `waitFor` for async assertions
2. Avoid hard-coded timeouts
3. Clean up after each test
4. Mock time-dependent functions

### **Better Assertions**

```typescript
// Good: Specific assertions
expect(result).toEqual({ id: 1, name: 'Test' });

// Better: Partial matchers for flexibility
expect(result).toMatchObject({ name: 'Test' });
expect(result.id).toBeDefined();

// Best: User-focused assertions
expect(screen.getByRole('alert')).toHaveTextContent('Success!');
```

---

**Happy Testing! 🎉**

If you have questions, check the [Testing Strategy](./TESTING_STRATEGY.md) or ask in the team chat.

