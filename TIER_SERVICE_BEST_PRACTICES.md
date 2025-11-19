# Tier Service Best Practices Analysis

## ✅ Current Implementation Review

### What's Good:
1. **Security**: Always fetches from database (never trusts client)
2. **Fail Closed**: Defaults to 'free' on error (secure)
3. **Logging**: Good logging for debugging
4. **Logic Reordering**: Checks paid tiers first (prevents false positives)

### What Needs Improvement:

#### 1. **Code Duplication** ❌
- Tier fetching logic is duplicated in **5+ places**:
  - `backend/server.mjs` (line 2190-2214)
  - `backend/services/messageService.js` (line 164-186)
  - `backend/middleware/tierGateMiddleware.mjs` (line 27-48)
  - `backend/middleware/authMiddleware.mjs` (line 42-63)
  - `backend/routes/feature-attempts.mjs` (line 24-34)

#### 2. **Inconsistent Normalization** ❌
- Only `/api/message` endpoint normalizes tier to lowercase
- Other places don't normalize, causing potential case sensitivity bugs
- Example: Database has "Studio" → `/api/message` works, but other endpoints fail

#### 3. **No Validation** ❌
- Doesn't validate tier is one of `['free', 'core', 'studio']`
- Unknown values silently default to 'free' without warning

#### 4. **No Type Safety** ❌
- No TypeScript types or JSDoc validation
- Easy to introduce bugs with typos

#### 5. **Inconsistent Error Handling** ⚠️
- Some places log errors, some don't
- Some fail closed, some fail open

## ✅ Best Practices Solution

### 1. **Centralized Tier Service** (`backend/services/tierService.mjs`)

**Benefits:**
- ✅ Single source of truth
- ✅ Consistent normalization everywhere
- ✅ Validation built-in
- ✅ Reusable utility functions
- ✅ Easier to test and maintain

**Key Functions:**
```javascript
// Normalize and validate tier
normalizeTier(rawTier) → 'free' | 'core' | 'studio'

// Fetch tier from database (with normalization)
getUserTier(userId, options) → Promise<Tier>

// Utility functions
isValidTier(tier) → boolean
isPaidTier(tier) → boolean
hasUnlimitedMessages(tier) → boolean
```

### 2. **Refactoring Plan**

#### Step 1: Update `/api/message` endpoint
```javascript
// BEFORE (current):
const rawTier = profile?.subscription_tier || 'free';
effectiveTier = typeof rawTier === 'string' ? rawTier.toLowerCase().trim() : 'free';

// AFTER (best practice):
import { getUserTier, isPaidTier } from '../services/tierService.mjs';
const effectiveTier = await getUserTier(userId);
```

#### Step 2: Update `tierGateMiddleware.mjs`
```javascript
// BEFORE:
tier = profile?.subscription_tier || 'free';

// AFTER:
import { getUserTier } from '../services/tierService.mjs';
const tier = await getUserTier(user.id);
```

#### Step 3: Update `authMiddleware.mjs`
```javascript
// BEFORE:
tier = profile?.subscription_tier || 'free';

// AFTER:
import { getUserTier } from '../services/tierService.mjs';
const tier = await getUserTier(userId);
```

### 3. **Database-Level Best Practice**

**Recommendation:** Add database constraint to ensure lowercase values:

```sql
-- Migration: Ensure subscription_tier is always lowercase
ALTER TABLE profiles 
ADD CONSTRAINT subscription_tier_lowercase 
CHECK (subscription_tier = LOWER(subscription_tier));

-- Or use a trigger to auto-normalize:
CREATE OR REPLACE FUNCTION normalize_subscription_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subscription_tier = LOWER(TRIM(NEW.subscription_tier));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_tier_on_insert
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION normalize_subscription_tier();
```

### 4. **Caching Best Practice**

**Current:** `authMiddleware` caches tier in Redis ✅

**Recommendation:** Use centralized tier service with caching:
```javascript
// tierService.mjs with caching
const TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserTier(userId, options = {}) {
  // Check cache first
  const cached = await redisService.getTier(userId);
  if (cached && Date.now() - cached.timestamp < TIER_CACHE_TTL) {
    return normalizeTier(cached.tier);
  }
  
  // Fetch from database
  const tier = await fetchTierFromDB(userId);
  
  // Cache it
  await redisService.setTier(userId, tier, TIER_CACHE_TTL);
  
  return normalizeTier(tier);
}
```

## 📊 Comparison: Current vs Best Practice

| Aspect | Current | Best Practice |
|--------|---------|---------------|
| **Code Duplication** | 5+ duplicate implementations | Single centralized service |
| **Normalization** | Only in `/api/message` | Everywhere via service |
| **Validation** | None | Built-in validation |
| **Type Safety** | None | TypeScript/JSDoc types |
| **Error Handling** | Inconsistent | Consistent with options |
| **Testing** | Hard (duplicated logic) | Easy (single function) |
| **Maintainability** | Low (change 5+ places) | High (change 1 place) |

## 🎯 Implementation Priority

1. **HIGH**: Create `tierService.mjs` ✅ (Done)
2. **HIGH**: Refactor `/api/message` to use service
3. **MEDIUM**: Refactor `tierGateMiddleware.mjs`
4. **MEDIUM**: Refactor `authMiddleware.mjs`
5. **LOW**: Add database-level normalization (nice-to-have)

## ✅ Conclusion

**Current fix is good for immediate problem**, but **centralized service is best practice** for:
- Consistency
- Maintainability
- Testability
- Type safety
- Future-proofing

**Recommendation:** Keep current fix (it works), but plan to refactor to centralized service in next sprint.

