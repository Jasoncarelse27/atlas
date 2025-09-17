// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY')!;

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { tier, priceId, userId, email, returnUrl, cancelUrl } = await req.json();

    if (!priceId || !userId || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields (priceId, userId, email)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const resp = await fetch('https://api.paddle.com/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: { email },
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: { user_id: userId, tier },
        success_url: returnUrl,
        cancel_url: cancelUrl
      })
    });

    const text = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: text }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const data = JSON.parse(text);
    const checkoutUrl = data?.data?.url ?? data?.url;
    return new Response(JSON.stringify({ checkoutUrl }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});


