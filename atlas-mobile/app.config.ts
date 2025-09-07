import 'dotenv/config';

export default {
  expo: {
    name: "atlas-mobile",
    slug: "atlas-mobile",
    scheme: "atlas",
    runtimeVersion: { policy: "sdkVersion" },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      BACKEND_URL: process.env.VITE_BACKEND_URL, // streaming proxy (existing backend)
    },
  },
};
