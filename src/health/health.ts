/**
 * Health checks aggregate: Dexie, Supabase Realtime, and Email adapter readiness.
 * Each checker is defensive and never throws — result is a structured object.
 */
export type HealthResult = {
  ok: boolean;
  timestamp: string;
  checks: {
    dexie?: { ok: boolean; detail?: string };
    supabaseRealtime?: { ok: boolean; detail?: string };
    emailAdapter?: { ok: boolean; detail?: string };
  };
};

async function checkDexie(): Promise<HealthResult['checks']['dexie']> {
  try {
    // Lazy import to avoid pulling IndexedDB in Node contexts
    const mod = await import('@/lib/db/dexieClient');
    // Touch something minimal if available
    if (mod?.db) { return { ok: true }; }
    return { ok: false, detail: 'Dexie client not initialized' };
  } catch (_e: unknown) {
    return { ok: false, detail: e?.message ?? 'Dexie check failed' };
  }
}

async function checkSupabaseRealtime(): Promise<HealthResult['checks']['supabaseRealtime']> {
  try {
    // Light ping: ensure client factory exists (avoid network calls in health)
    const mod = await import('@/lib/realtime/supabaseRealtime');
    if (mod?.createRealtimeAdapter) { return { ok: true }; }
    return { ok: false, detail: 'Realtime adapter missing' };
  } catch (_e: unknown) {
    return { ok: false, detail: e?.message ?? 'Realtime check failed' };
  }
}

async function checkEmailAdapter(): Promise<HealthResult['checks']['emailAdapter']> {
  try {
    const live = String(import.meta.env?.EMAIL_LIVE_MODE ?? 'false') === 'true';
    const mod = await import('@/services/mailerLiteAdapter');
    if (mod?.sendWelcomeEmail) {
      // If live mode, ensure API key is present; otherwise OK (guard rails handle mock/dry-run).
      if (live && !import.meta.env?.MAILERLITE_API_KEY) {
        return { ok: false, detail: 'EMAIL_LIVE_MODE=true but MAILERLITE_API_KEY missing' };
      }
      return { ok: true };
    }
    return { ok: false, detail: 'mailerLiteAdapter missing' };
  } catch (_e: unknown) {
    return { ok: false, detail: e?.message ?? 'Email adapter check failed' };
  }
}

export async function getHealth(): Promise<HealthResult> {
  const [dexie, supabaseRealtime, emailAdapter] = await Promise.all([
    checkDexie(), checkSupabaseRealtime(), checkEmailAdapter()
  ]);
  const ok = !!dexie?.ok && !!supabaseRealtime?.ok && !!emailAdapter?.ok;
  return {
    ok,
    timestamp: new Date().toISOString(),
    checks: { dexie, supabaseRealtime, emailAdapter }
  };
}
