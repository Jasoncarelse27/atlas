# Atlas Cursor-Style Billing System Documentation

## Overview

Atlas implements a Cursor-style billing system with monthly credit allowances and on-demand overage billing. This system tracks token usage, calculates costs, and automatically bills users for usage exceeding their included credits.

## Architecture

### Database Schema

#### `billing_periods`
Tracks monthly billing cycles per user:
- `id` (UUID): Primary key
- `user_id` (UUID): References `auth.users`
- `period_start` (TIMESTAMPTZ): First day of billing month (UTC)
- `period_end` (TIMESTAMPTZ): First day of next month (UTC)
- `tier` (TEXT): User tier at period start ('free', 'core', 'studio')
- `created_at`, `updated_at`: Timestamps

#### `usage_snapshots`
Aggregated token usage per billing period per model:
- `id` (UUID): Primary key
- `user_id` (UUID): References `auth.users`
- `billing_period_id` (UUID): References `billing_periods`
- `model` (TEXT): AI model name (e.g. 'claude-sonnet-4-5-20250929')
- `input_tokens` (BIGINT): Total input tokens
- `output_tokens` (BIGINT): Total output tokens
- `total_cost_usd` (NUMERIC): Total cost in USD
- `created_at`, `updated_at`: Timestamps

#### `overage_charges`
Tracks overage invoices (mid-month + end-month):
- `id` (UUID): Primary key
- `user_id` (UUID): References `auth.users`
- `billing_period_id` (UUID): References `billing_periods`
- `fastspring_order_id` (TEXT): FastSpring order ID (NULL until charged)
- `description` (TEXT): Invoice description
- `tokens` (BIGINT): Total tokens causing overage
- `cost_usd` (NUMERIC): Overage amount in USD
- `status` (TEXT): 'pending', 'charged', 'failed', 'refunded'
- `created_at`, `updated_at`, `charged_at`: Timestamps

### Postgres Function

#### `upsert_usage_snapshot()`
Atomically upserts usage snapshots:
- Finds or creates billing period for user
- Upserts usage snapshot for billing period + model
- Returns `billing_period_id`

**Parameters:**
- `p_user_id` (UUID)
- `p_model` (TEXT)
- `p_input_tokens` (BIGINT)
- `p_output_tokens` (BIGINT)
- `p_cost_usd` (NUMERIC)

## Usage Tracking

### Token Logging Flow

1. **Message Processing**: When a message is processed via `/api/message`:
   - AI response includes `usage.input_tokens` and `usage.output_tokens`
   - `logTokenUsage()` is called with token counts

2. **Usage Logging Service** (`usageLoggingService.mjs`):
   - Inserts raw log into `usage_logs` table (backward compatibility)
   - Calls `upsert_usage_snapshot()` Postgres function
   - Function creates/updates aggregated snapshot

3. **Snapshot Aggregation**:
   - Snapshots are aggregated per billing period per model
   - Costs are calculated using `calculateTokenCostUsd()` from `intelligentTierSystem.mjs`

### Pricing

Token costs are defined in `backend/config/intelligentTierSystem.mjs`:

```javascript
MODEL_PRICING = {
  'claude-3-haiku-20240307': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
  'claude-3-sonnet-20240229': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-opus-20240229': { inputPer1K: 0.015, outputPer1K: 0.075 },
  // ... legacy model names for compatibility
}
```

### Included Credits

Monthly credit allowances per tier:
- **Free**: $0 (no included credits)
- **Core**: $19.99 (matches subscription price)
- **Studio**: $149.99 (matches subscription price)

## Overage Billing

### Billing Cycle

The billing cycle runs daily via cron job:

1. **Get Active Users**: Fetch all Core/Studio users with active subscriptions
2. **Calculate Overage**: For each user:
   - Get current billing period
   - Sum `usage_snapshots.total_cost_usd` for period
   - Calculate: `overage = totalCost - includedCredits`
3. **Create Charges**: If overage > $20 minimum:
   - Check if charge already exists for period
   - Create `overage_charge` with status='pending'
   - Description: "Atlas Usage for [Month] [Year] ([Mid-Month/End-Month] Invoice)"
4. **Process Charges**: For all pending charges:
   - Create FastSpring one-time order
   - Update charge with `fastspring_order_id` and status='charged'

### Mid-Month vs End-Month

- **Mid-Month**: Charges created in first half of month (days 1-14)
- **End-Month**: Charges created in second half of month (days 15+)

### Minimum Charge Threshold

Overage charges are only created if:
- `overageUsd >= $20.00` (configurable via `OVERAGE_MIN_CHARGE_USD`)

## FastSpring Integration

### One-Time Orders

Overage invoices are created as one-time orders in FastSpring:

1. **Product**: `atlas-usage-overage` (must be created in FastSpring dashboard)
2. **Order Creation**: Via FastSpring Orders API (`POST /orders`)
3. **Linking**: Orders are linked to user's FastSpring account (if available)
4. **Receipt**: Receipt URL is stored in `overage_charges.fastspring_order_id`

### FastSpring Service

`backend/services/fastspringOverageService.mjs`:
- `createOverageInvoice()`: Creates one-time order
- `getFastSpringOrderReceiptUrl()`: Fetches receipt URL for order

## API Endpoints

### `GET /api/billing/summary`
Returns current billing period summary:
```json
{
  "period": { "start": "2025-11-01T00:00:00Z", "end": "2025-12-01T00:00:00Z" },
  "tier": "studio",
  "includedCreditsUsd": 149.99,
  "usedCreditsUsd": 187.42,
  "remainingCreditsUsd": -37.43,
  "models": [
    {
      "model": "claude-sonnet-4-5-20250929",
      "inputTokens": 15000,
      "outputTokens": 5000,
      "totalCostUsd": 75.00
    }
  ],
  "overage": {
    "totalOverageUsd": 37.43,
    "charges": [...]
  }
}
```

### `GET /api/billing/invoices`
Returns all overage invoices (optionally filtered by month):
- Query param: `?month=2025-11` (YYYY-MM format)

### `POST /internal/billing/run-overage-cycle`
Internal endpoint for cron job:
- Protected by `INTERNAL_SECRET` environment variable
- Runs billing cycle for all active users
- Returns summary of processed users, charges created, charges processed

## Cron Jobs

### Supabase Edge Function

**Location**: `supabase/functions/billing-cycle/index.ts`

**Schedule**: Daily at 2 AM UTC (configure in Supabase dashboard)

**Configuration**:
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job:
   - Name: `billing-cycle`
   - Schedule: `0 2 * * *` (2 AM UTC daily)
   - Function: `billing-cycle`
   - Headers: None (cron jobs don't send auth headers)

**Alternative: Railway Cron**

If Supabase Edge Functions unavailable, use Railway cron:
- Schedule: Daily at 2 AM UTC
- Endpoint: `POST https://your-railway-app.railway.app/internal/billing/run-overage-cycle`
- Headers: `Authorization: Bearer <INTERNAL_SECRET>`

## Frontend

### Billing Dashboard

**Route**: `/billing`

**Components**:
- `BillingDashboard.tsx`: Main dashboard page
- `useBillingSummary()`: React Query hook for summary
- `useBillingInvoices()`: React Query hook for invoices

**Features**:
- Included Usage: Shows token usage per model with costs
- On-Demand Usage: Shows total overage for current period
- Invoices: Table of all overage invoices with month filter

### Usage Counter Integration

`UsageCounter` component can be extended to show:
- "This period: $X.XX of $Y.YY included"
- Progress bar for credit usage
- Link to billing dashboard

## MailerLite Integration (Phase 5 - TODO)

### Email Triggers

1. **80% Usage Threshold**: Send email when user reaches 80% of included credits
2. **Overage Invoice**: Send email when overage charge is marked 'charged'

### Implementation

Extend `backend/services/mailerService.mjs`:
- `sendUsageThresholdEmail()`: Triggered at 80% usage
- `sendOverageInvoiceEmail()`: Triggered when charge status changes to 'charged'

## Troubleshooting

### Billing Period Not Created

**Symptom**: `getOrCreateCurrentBillingPeriod()` fails

**Solution**:
- Check user tier exists in `profiles.subscription_tier`
- Verify `billing_periods` table exists and RLS policies allow inserts

### Usage Not Aggregating

**Symptom**: `usage_snapshots` table empty despite usage

**Solution**:
- Check `logTokenUsage()` is being called after AI responses
- Verify `upsert_usage_snapshot()` function exists and is callable
- Check Postgres logs for function errors

### FastSpring Invoice Creation Fails

**Symptom**: `overage_charges.status` remains 'pending'

**Solution**:
- Verify FastSpring API credentials (`FASTSPRING_API_USERNAME`, `FASTSPRING_API_PASSWORD`)
- Check `atlas-usage-overage` product exists in FastSpring dashboard
- Review FastSpring API logs for error details

### Cron Job Not Running

**Symptom**: Billing cycle not executing

**Solution**:
- Verify Supabase cron job is configured and enabled
- Check Edge Function logs in Supabase dashboard
- Test endpoint manually: `POST /internal/billing/run-overage-cycle` with `Authorization: Bearer <INTERNAL_SECRET>`

## Manual Testing

### Test Usage Logging

```bash
# Send a message via API
curl -X POST https://your-backend.com/api/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "conversationId": "..."}'

# Check usage_snapshots
# Query Supabase: SELECT * FROM usage_snapshots WHERE user_id = '<user_id>' ORDER BY created_at DESC;
```

### Test Billing Summary

```bash
curl https://your-backend.com/api/billing/summary \
  -H "Authorization: Bearer <token>"
```

### Test Billing Cycle

```bash
curl -X POST https://your-backend.com/internal/billing/run-overage-cycle \
  -H "Authorization: Bearer <INTERNAL_SECRET>"
```

## Environment Variables

### Backend

- `INTERNAL_SECRET`: Secret for internal endpoints (cron jobs)
- `FASTSPRING_API_USERNAME`: FastSpring API username
- `FASTSPRING_API_PASSWORD`: FastSpring API password
- `FASTSPRING_STORE_ID`: FastSpring store ID

### Supabase Edge Function

- `INTERNAL_SECRET`: Same as backend
- `BACKEND_URL`: Backend API URL (defaults to Railway production URL)

## Future Enhancements

1. **MailerLite Integration**: Email notifications for usage thresholds and invoices
2. **Usage Forecasting**: Predict when user will hit limits
3. **Budget Alerts**: Customizable spending alerts
4. **Invoice PDFs**: Generate PDF invoices for download
5. **Usage Analytics**: Detailed usage charts and trends

