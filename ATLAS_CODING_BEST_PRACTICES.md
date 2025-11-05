# 🎯 Atlas Coding Best Practices - Quick Reference

**Version:** 1.0  
**Last Updated:** November 5, 2025  
**Purpose:** Quick reference for maintaining code quality and consistency

---

## 🚨 CRITICAL RULES (Never Break)

### 1. Tier Enforcement
```typescript
// ✅ ALWAYS use centralized hooks
import { useTierAccess } from '@/hooks/useTierAccess';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

const { tier, canUse } = useTierAccess();
const { canUse: canUseVoice } = useFeatureAccess('voice');

// ❌ NEVER hardcode tier checks
if (userTier === 'free') { /* NO! */ }
```

### 2. State Management
```typescript
// ✅ ALWAYS use Zustand wrapper
import { create } from '@/lib/zustand-wrapper';

// ❌ NEVER import directly from zustand
import { create } from 'zustand'; // NO!
```

### 3. Security - Tier Handling
```typescript
// ✅ ALWAYS fetch tier from database
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription_tier')
  .eq('id', userId)
  .single();
const tier = profile?.subscription_tier || 'free';

// ❌ NEVER trust client-sent tier
const tier = req.body.tier; // SECURITY VULNERABILITY!
```

### 4. Error Handling
```typescript
// ✅ ALWAYS use error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <Component />
</ErrorBoundary>

// ✅ ALWAYS catch async errors
try {
  await riskyOperation();
} catch (error) {
  logger.error('[Component] Operation failed', error);
  toast.error('Something went wrong');
}
```

---

## 📋 CODE QUALITY STANDARDS

### TypeScript
```typescript
// ✅ Use strict types
interface UserProfile {
  id: string;
  tier: 'free' | 'core' | 'studio';
  email: string;
}

// ❌ Avoid 'any' unless absolutely necessary
const data: any = response; // NO!

// ✅ Use type guards
function isUserProfile(obj: unknown): obj is UserProfile {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
```

### Component Structure
```typescript
// ✅ Standard component pattern
interface ComponentProps {
  userId: string;
  onAction: (id: string) => void;
}

export const Component: React.FC<ComponentProps> = ({ userId, onAction }) => {
  // 1. Hooks
  const { tier } = useTierAccess();
  
  // 2. State
  const [loading, setLoading] = useState(false);
  
  // 3. Effects
  useEffect(() => {
    // Effect logic
  }, [userId]);
  
  // 4. Handlers
  const handleClick = useCallback(() => {
    onAction(userId);
  }, [userId, onAction]);
  
  // 5. Render
  return <div>...</div>;
};
```

### Async Operations
```typescript
// ✅ Use async/await with error handling
const fetchData = async (): Promise<Data> => {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  } catch (error) {
    logger.error('[Service] Fetch failed', error);
    throw error;
  }
};

// ❌ Don't forget error handling
const data = await fetch('/api/data'); // Missing try/catch!
```

---

## 🎨 STYLING GUIDELINES

### Tailwind CSS
```typescript
// ✅ Use Tailwind classes
<div className="flex items-center gap-4 p-4 bg-white rounded-lg">

// ✅ Responsive design (mobile-first)
<div className="p-4 md:p-6 lg:p-8">

// ❌ Avoid inline styles
<div style={{ padding: '16px' }}> // NO!

// ✅ Use CSS variables for theming
<div className="bg-atlas-pearl text-atlas-stone">
```

### Mobile Optimization
```typescript
// ✅ Touch targets minimum 44px
<button className="min-h-[44px] min-w-[44px]">

// ✅ Prevent iOS zoom on input focus
<input style={{ fontSize: '16px' }} />

// ✅ Safe area insets for notched devices
<div style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
```

---

## 🔒 SECURITY CHECKLIST

### Before Committing
- [ ] No secrets in code (use env variables)
- [ ] No client-sent tier acceptance
- [ ] All inputs validated
- [ ] SQL injection prevented (use parameterized queries)
- [ ] XSS prevented (sanitize user input)
- [ ] CORS properly configured
- [ ] Authentication required for protected routes

### Common Vulnerabilities to Avoid
```typescript
// ❌ SQL Injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Parameterized queries
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);

// ❌ XSS Vulnerability
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ Sanitize HTML
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

---

## ⚡ PERFORMANCE BEST PRACTICES

### React Optimization
```typescript
// ✅ Memoize expensive computations
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// ✅ Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// ✅ Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// ❌ Don't create objects/functions in render
<Component style={{ margin: 10 }} /> // Creates new object every render!
```

### Data Fetching
```typescript
// ✅ Use delta sync instead of full sync
async deltaSync(userId: string, lastSync: string) {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .gte('updated_at', lastSync) // ✅ Only fetch changes
    .limit(50); // ✅ Pagination
}

// ❌ Don't fetch everything every time
async fullSync(userId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId); // ❌ Fetches ALL data!
}
```

### Bundle Size
```typescript
// ✅ Code splitting
const Feature = lazy(() => import('./Feature'));

// ✅ Tree shaking friendly imports
import { specificFunction } from 'library'; // ✅
import * as library from 'library'; // ❌ Imports everything

// ✅ Remove unused imports
// ❌ Don't import entire libraries for one function
```

---

## 🧪 TESTING STANDARDS

### Unit Tests
```typescript
// ✅ Test critical business logic
describe('Tier Enforcement', () => {
  it('should block free tier after 15 messages', () => {
    const result = checkMessageLimit('free', 15);
    expect(result.allowed).toBe(false);
  });
});

// ✅ Test error cases
it('should handle API errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  await expect(fetchData()).rejects.toThrow();
});
```

### Integration Tests
```typescript
// ✅ Test database operations
describe('Message Sync', () => {
  it('should sync messages from Supabase', async () => {
    const messages = await syncMessages(userId);
    expect(messages).toHaveLength(10);
  });
});
```

---

## 📱 MOBILE-SPECIFIC GUIDELINES

### Touch Interactions
```typescript
// ✅ Minimum touch target: 44x44px
<button className="min-h-[44px] min-w-[44px] p-2">

// ✅ Prevent double-tap zoom
<button className="touch-manipulation">

// ✅ Handle safe areas
<div style={{ 
  paddingTop: 'env(safe-area-inset-top)',
  paddingBottom: 'env(safe-area-inset-bottom)'
}}>
```

### Responsive Design
```typescript
// ✅ Mobile-first approach
<div className="p-4 md:p-6 lg:p-8">

// ✅ Hide/show based on screen size
<div className="hidden md:block">Desktop only</div>
<div className="block md:hidden">Mobile only</div>

// ❌ Don't use fixed pixel widths
<div style={{ width: '300px' }}> // ❌ Breaks on mobile!
```

---

## 🐛 DEBUGGING GUIDELINES

### Logging
```typescript
// ✅ Use logger service
import { logger } from '@/lib/logger';

logger.debug('[Component] Debug info', { userId, tier });
logger.error('[Component] Error occurred', error);

// ❌ Don't use console.log in production
console.log('Debug info'); // ❌ Gets stripped in production

// ✅ Conditional logging
if (import.meta.env.DEV) {
  console.log('Development only');
}
```

### Error Messages
```typescript
// ✅ User-friendly error messages
toast.error('Failed to send message. Please try again.');

// ❌ Don't expose technical details
toast.error(`Error: ${error.message}`); // ❌ Too technical!

// ✅ Log technical details separately
logger.error('[Service] API error', { error, context });
toast.error('Something went wrong. Please try again.');
```

---

## 📚 CODE ORGANIZATION

### File Structure
```
src/
  components/        # Reusable UI components
  features/         # Feature-specific code
  hooks/            # Custom React hooks
  lib/              # Shared utilities
  services/         # API services
  stores/           # Zustand stores
  types/            # TypeScript types
  utils/            # Helper functions
```

### Naming Conventions
```typescript
// ✅ Components: PascalCase
export const MessageBubble: React.FC = () => {};

// ✅ Hooks: camelCase with 'use' prefix
export const useTierAccess = () => {};

// ✅ Services: camelCase
export const chatService = {};

// ✅ Types: PascalCase
interface UserProfile {}

// ✅ Constants: UPPER_SNAKE_CASE
const MAX_MESSAGES = 15;
```

---

## ✅ PRE-COMMIT CHECKLIST

Before committing code:
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Linter passes (`npm run lint`)
- [ ] No `console.log` statements (use logger)
- [ ] No `any` types (use proper types)
- [ ] Tier checks use centralized hooks
- [ ] Error handling implemented
- [ ] Mobile responsive (test in DevTools)
- [ ] No secrets or hardcoded values
- [ ] Comments explain "why", not "what"

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying:
- [ ] All critical issues fixed (see audit report)
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Security vulnerabilities addressed
- [ ] Performance tested (Lighthouse)
- [ ] Mobile tested (iOS + Android)
- [ ] Error tracking configured (Sentry)

---

## 📖 QUICK REFERENCE

### Import Patterns
```typescript
// ✅ Absolute imports with @ alias
import { useTierAccess } from '@/hooks/useTierAccess';
import { chatService } from '@/services/chatService';

// ❌ Relative imports (harder to refactor)
import { useTierAccess } from '../../hooks/useTierAccess';
```

### Common Hooks
```typescript
// Tier access
const { tier, canUse, attemptFeature } = useTierAccess();

// Feature access
const { canUse: canUseVoice } = useFeatureAccess('voice');

// Message limits
const { remaining, limit, isLimitReached } = useMessageLimit();

// Theme
const { isDarkMode, toggleTheme } = useThemeMode();
```

### Common Services
```typescript
// Chat
import { chatService } from '@/services/chatService';

// Subscriptions
import { fastspringService } from '@/services/fastspringService';

// Voice
import { voiceService } from '@/services/voiceService';

// Images
import { imageService } from '@/services/imageService';
```

---

**Remember:** When in doubt, check `ATLAS_COMPREHENSIVE_AUDIT_REPORT.md` for detailed issues and fixes.

