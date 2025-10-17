# Atlas Clean Implementation TODO

## Critical Issues to Fix

### 1. Generate Supabase Types (Priority: HIGH)
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Generate types from your Supabase project
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts

# Then update supabaseClient.ts to use types:
import type { Database } from '@/types/database.types'
export const supabase = createClient<Database>(url, key)
```

### 2. Replace Remaining Console Statements
Files needing logger replacement:
- [ ] `src/services/voiceService.ts` (15 console statements)
- [ ] `src/hooks/useCustomization.ts` (7 console statements)
- [ ] `src/stores/useMessageStore.ts` (2 console statements)
- [ ] `src/utils/` directory (multiple files)
- [ ] `src/features/chat/services/subscriptionService.ts`

### 3. Fix TypeScript Errors in Services
After generating Supabase types, if errors persist:
```typescript
// Add type assertions as temporary fix
const { data, error } = await supabase
  .from('daily_usage')
  .insert({ /* data */ } as any)  // Temporary until types are generated
```

### 4. Remove Unused Code
- Remove or implement `getProfileFromDexie` function in subscriptionApi.ts

### 5. Add Missing Type Definitions
Create proper interfaces for:
- `DailyUsage` table structure
- `FastSpringSubscription` table structure
- Other database tables

## Nice-to-Have Improvements

### 1. Consistent Error Handling
- Wrap all Supabase queries in try-catch blocks
- Use logger.error for all catch blocks

### 2. Performance Optimizations
- Review and optimize the 1.19MB ChatPage bundle size
- Consider code splitting for large components

### 3. Complete Logger Migration
- Create a script to automatically replace console.* with logger.*
- Add ESLint rule to prevent new console statements

## Verification Steps
1. Run `npm run typecheck` - Should show 0 errors
2. Run `npm run lint` - Should show 0 errors
3. Run `npm run build` - Should complete without warnings
4. Check for console statements: `grep -r "console\." src/ | grep -v logger.ts | wc -l` - Should be 0
