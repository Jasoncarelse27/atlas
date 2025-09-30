# FastSpring Webhook Integration Guide

## 🔑 FastSpring Webhook → Atlas Event Mapping

| FastSpring Event | Atlas Event Type | Notes |
|------------------|------------------|-------|
| `subscription.activated` | `activation` | New subscription |
| `subscription.trial.converted` | `activation` | Trial → paid |
| `subscription.updated` | `upgrade`/`downgrade` | Compare old vs new tier |
| `subscription.canceled` | `cancellation` | User cancels |
| `subscription.deactivated` | `cancellation` | End of billing cycle |
| `subscription.charge.completed` | _(ignore)_ | Billing success only |
| `subscription.trial.reminder` | _(ignore)_ | Notification only |
| `subscription.charge.failed` | _(optional)_ | Could log as `payment_failed` |

## ⚡ Example Webhook Payload (FastSpring)

```json
{
  "id": "sub_12345",
  "eventType": "subscription.updated",
  "created": "2025-09-23T21:41:07.394Z",
  "data": {
    "accountId": "user-uuid-from-supabase",
    "oldProduct": "atlas-core",
    "newProduct": "atlas-studio"
  }
}
```

## 🗄️ Database Schema

### `subscription_audit` Table
```sql
create table public.subscription_audit (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    event_type text check (event_type in ('activation', 'cancellation', 'upgrade', 'downgrade')),
    old_tier text,
    new_tier text not null,
    source text default 'fastspring',
    created_at timestamptz default now()
);
```

## 🧪 Testing

### Local Testing
```bash
# Run the test harness
deno run --allow-net --allow-env scripts/test-fastspring-webhook.ts

# Run unit tests
npm run test

# Run type checking
npm run type-check
```

### CI/CD Pipeline
- **Push to main/develop**: Runs Vitest tests automatically
- **Pull Requests**: Validates tests before merge
- **Linting**: Ensures code quality standards

## 🚀 Deployment

### 1. Apply Database Migrations
```bash
# Apply the subscription_audit table migration
supabase db push
```

### 2. Deploy Edge Function
```bash
# Deploy the FastSpring webhook function
supabase functions deploy fastspring-webhook
```

### 3. Configure FastSpring
- Set webhook URL: `https://your-project.supabase.co/functions/v1/fastspring-webhook`
- Enable events: `subscription.activated`, `subscription.updated`, `subscription.canceled`

## 📊 Admin API Usage

### Get Subscription Overview
```bash
curl -X GET "http://localhost:3000/admin/subscriptions/overview" \
  -H "x-admin-key: $ADMIN_API_KEY"
```

### Response Format
```json
{
  "success": true,
  "overview": [
    {
      "email": "user@example.com",
      "current_tier": "studio",
      "activations": 1,
      "cancellations": 0,
      "upgrades": 2,
      "downgrades": 0,
      "last_change": "2025-09-23T21:41:07.394Z"
    }
  ],
  "timestamp": "2025-09-23T21:41:07.394Z"
}
```

## 🔧 Development Workflow

1. **Make changes** to webhook logic or tests
2. **Run tests locally**: `npm run test`
3. **Push to GitHub**: CI automatically runs tests
4. **Deploy**: After tests pass, deploy to production
5. **Monitor**: Check webhook logs and database changes

## 🎯 Next Steps

1. Deploy the `subscription_audit` migration
2. Add the FastSpring webhook function
3. Update admin API to call the improved `subscription_overview()`
4. Run the test harness to simulate FastSpring sandbox events
5. Run Vitest locally
6. Push to GitHub → CI pipeline will auto-run Vitest tests on every PR/push
