import { createClient } from '@supabase/supabase-js';

// Preferred: Expo public env vars (SDK 49+)
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Optional fallback: values exposed via app.config.ts -> extra
let extraUrl: string | undefined;
let extraKey: string | undefined;
try {
  // Avoid importing expo-constants if not installed; Expo apps already have it
  // but this keeps TS quiet in web tooling.
  // @ts-ignore
  const Constants = require('expo-constants').default;
  extraUrl = Constants?.expoConfig?.extra?.supabaseUrl;
  extraKey = Constants?.expoConfig?.extra?.supabaseAnonKey;
} catch { /* noop */ }

const supabaseUrl = envUrl || extraUrl;
const supabaseAnonKey = envKey || extraKey;

if (!supabaseUrl) {
  throw new Error('[runtime not ready]: SUPABASE_URL is required. Set EXPO_PUBLIC_SUPABASE_URL in .env');
}
if (!supabaseAnonKey) {
  throw new Error('[runtime not ready]: SUPABASE_ANON_KEY is required. Set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);