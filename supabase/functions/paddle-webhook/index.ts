// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PADDLE_PUBLIC_KEY = Deno.env.get('PADDLE_PUBLIC_KEY')!;
const MAILERLITE_API_KEY = Deno.env.get('MAILERLITE_API_KEY')!;

const ML_API = 'https://connect.mailerlite.com/api';

const GROUPS = {
  free: Deno.env.get('MAILERLITE_GROUP_FREE')!,
  pro_monthly: Deno.env.get('MAILERLITE_GROUP_PREMIUM_MONTHLY')!,
  pro_yearly: Deno.env.get('MAILERLITE_GROUP_PREMIUM_YEARLY')!,
  bundle: Deno.env.get('MAILERLITE_GROUP_COMPLETE_BUNDLE') || undefined
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// TODO: Implement true Paddle signature verification per docs.
function verifyPaddle(_req: Request, _rawBody: string) {
  return true;
}

async function mlUpsertSubscriber(email: string, name?: string) {
  const resp = await fetch(`${ML_API}/subscribers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MAILERLITE_API_KEY}` },
    body: JSON.stringify({ email, fields: name ? { name } : undefined })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`MailerLite upsert failed: ${resp.status} ${JSON.stringify(data)}`);
  return data.data?.id || data.id;
}

async function mlAddToGroup(groupId: string, subscriberId: string) {
  await fetch(`${ML_API}/groups/${groupId}/subscribers/${subscriberId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MAILERLITE_API_KEY}` }
  });
}

async function mlRemoveFromGroup(groupId: string, subscriberId: string) {
  await fetch(`${ML_API}/groups/${groupId}/subscribers/${subscriberId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${MAILERLITE_API_KEY}` }
  });
}

async function syncMailerLite(email: string, action: 'activate'|'cancel'|'refund', plan: { tier: 'free'|'pro'|'pro_max', billing?: 'monthly'|'yearly', bundle?: boolean }, name?: string) {
  const subId = await mlUpsertSubscriber(email, name);
  let targetGroup: string | undefined;
  if (action === 'cancel' || action === 'refund' || plan.tier === 'free') {
    targetGroup = GROUPS.free;
  } else if (plan.bundle && GROUPS.bundle) {
    targetGroup = GROUPS.bundle;
  } else if (plan.billing === 'yearly') {
    targetGroup = GROUPS.pro_yearly;
  } else {
    targetGroup = GROUPS.pro_monthly;
  }
  if (targetGroup) await mlAddToGroup(targetGroup, subId);
  const toRemove = [GROUPS.free, GROUPS.pro_monthly, GROUPS.pro_yearly, GROUPS.bundle].filter(Boolean) as string[];
  for (const g of toRemove) if (g !== targetGroup) await mlRemoveFromGroup(g, subId);
}

serve(async (req) => {
  const raw = await req.text();
  if (!verifyPaddle(req, raw)) return new Response('Invalid signature', { status: 400 });

  const evt = JSON.parse(raw);
  const meta = evt?.data || evt;

  const userId = meta?.custom_data?.user_id;
  const tier = (meta?.custom_data?.tier ?? 'pro') as 'free'|'pro'|'pro_max';
  const subId = meta?.subscription_id ?? meta?.id;
  const email = meta?.customer?.email ?? meta?.customer_email;
  const name = meta?.customer?.name;
  const billing = meta?.items?.[0]?.price?.billing_cycle?.interval === 'year' ? 'yearly' : 'monthly';

  if (!userId) return new Response('Missing user_id', { status: 400 });

  const t = String(evt?.event_type || '');
  const status = t.includes('canceled') ? 'cancelled'
              : t.includes('paused') ? 'cancelled'
              : 'active';

  await supabase.from('profiles')
    .update({
      tier,
      subscription_status: status,
      paddle_customer_id: meta?.customer_id ?? null,
      paddle_subscription_id: subId ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (email) {
    if (t.includes('subscription.activated') || t.includes('transaction.completed')) {
      await syncMailerLite(email, 'activate', { tier, billing }, name);
    } else if (t.includes('subscription.canceled')) {
      await syncMailerLite(email, 'cancel', { tier: 'free' }, name);
    } else if (t.includes('transaction.refunded')) {
      await syncMailerLite(email, 'refund', { tier: 'free' }, name);
    }
  }

  return new Response('ok');
});


