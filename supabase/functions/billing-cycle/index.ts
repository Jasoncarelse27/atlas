// Atlas Billing Cycle Edge Function
// Cursor-Style Billing System - Cron Job for Overage Billing
// Runs daily to calculate and charge overages

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INTERNAL_SECRET = Deno.env.get('INTERNAL_SECRET') || Deno.env.get('RAILWAY_INTERNAL_SECRET');
const BACKEND_URL = Deno.env.get('BACKEND_URL') || Deno.env.get('VITE_API_URL') || 'https://atlas-production-2123.up.railway.app';

serve(async (req) => {
  try {
    // Verify internal secret
    const authHeader = req.headers.get('authorization');
    const expectedSecret = INTERNAL_SECRET;

    if (!expectedSecret) {
      console.error('[BillingCycle] INTERNAL_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Internal secret not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Allow both cron trigger (no auth) and manual trigger (with auth)
    // Supabase cron jobs don't send auth headers, so we check for cron context
    const isCronTrigger = req.headers.get('x-supabase-cron') === 'true' || !authHeader;
    
    if (!isCronTrigger && (!authHeader || authHeader !== `Bearer ${expectedSecret}`)) {
      console.warn('[BillingCycle] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[BillingCycle] 🚀 Starting billing cycle...');

    // Call backend billing cycle endpoint
    const response = await fetch(`${BACKEND_URL}/internal/billing/run-overage-cycle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${expectedSecret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BillingCycle] Backend error (${response.status}):`, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Backend billing cycle failed',
          status: response.status,
          details: errorText 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = await response.json();
    console.log('[BillingCycle] ✅ Billing cycle complete:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ 
        success: true,
        results: results.results || results
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[BillingCycle] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

