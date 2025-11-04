# 💳 Credit-Based Usage Billing System Design (Cursor-Style Model)

**Date:** November 4, 2025  
**Status:** Design Complete - Ready for Implementation  
**Reference:** Cursor AI pricing model

---

## 🎯 **System Overview**

Implement a credit-based, usage-metered billing system in Atlas (like Cursor's model) using Supabase + FastSpring.

**Model:** Subscription Fee → Monthly Credit Allowance → Pay-as-you-go After Credit

---

## 💰 **Pricing Structure**

### **Credit Allowances**

```typescript
export const MONTHLY_CREDIT_ALLOWANCE = {
  free:   { monthlyPrice: 0,      creditAmount: 0,      creditMultiplier: 0 },
  core:   { monthlyPrice: 19.99,  creditAmount: 19.99,  creditMultiplier: 1.0 },
  studio: { monthlyPrice: 149.99, creditAmount: 299.98, creditMultiplier: 2.0 } // 2× multiplier
};
```

### **Token Costs**

```typescript
export const TOKEN_COSTS = {
  'claude-3-haiku':  0.00025 / 1000,  // $0.25 per 1M tokens
  'claude-3-sonnet': 0.003 / 1000,    // $3 per 1M tokens
  'claude-3-opus':   0.015 / 1000     // $15 per 1M tokens
};
```

---

## 🗄️ **Database Schema**

### **Monthly Credits Table**

```sql
create table if not exists monthly_credits (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  billing_period date not null,
  tier text check (tier in ('free','core','studio')),
  credit_amount numeric(10,2) not null,
  credit_used numeric(10,4) default 0,
  credit_remaining numeric(10,4) not null,
  overage_amount numeric(10,4) default 0,
  tokens_used int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, billing_period)
);
```

### **Overage Charges Table**

```sql
create table if not exists overage_charges (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  billing_period date not null,
  amount numeric(10,4) not null,
  tokens_used int not null,
  status text check (status in ('pending','charged','failed','refunded')),
  fastspring_transaction_id text,
  created_at timestamptz default now(),
  charged_at timestamptz,
  unique(user_id, billing_period)
);
```

---

## 🔒 **Enforcement Logic**

| Tier | Behavior | Enforcement |
|------|----------|-------------|
| Free / Core | Hard stop at 0 credit | Block AI usage |
| Studio | Soft stop | Continue and auto-bill |

**Code:**
```typescript
if (creditRemaining <= 0 && tier !== 'studio')
  throw new Error("Credit limit reached. Please upgrade or wait for next reset.");
```

---

## 📊 **Profit Model**

**Studio User @ $149.99/month:**
- Included credits: $299.98 (≈ 2× plan value)
- Cost per 1K tokens: $0.01 (example)
- If user fully uses credits → break even
- Most users use 50–75% → profit retained
- Overages billed at markup (1.5–2× cost) → pure profit

**In short:**
- Break-even if they max out
- Profit if they don't
- More profit if they exceed

---

## ⚙️ **Implementation Components**

1. **CreditBillingService** - Track usage, deduct credits, queue overages
2. **Monthly Reset Edge Function** - Reset credits on 1st of each month
3. **Nightly Auto-Charge Edge Function** - Process pending overage charges via FastSpring
4. **UI Credit Indicator** - Show remaining credit to users

---

## 📝 **Status**

- ✅ Design complete
- ✅ Database schema designed
- ✅ Service architecture planned
- ⏳ Ready for implementation

---

**See:** Full implementation instruction provided earlier in session.

