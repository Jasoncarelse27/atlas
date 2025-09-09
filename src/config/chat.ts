export const CHAT_CONFIG = {
  apiBase: import.meta.env.VITE_ATLAS_API_BASE ?? 'http://localhost:8000',
  streamPath: '/message?stream=1',
  useMockWhenMissingCreds: true,
  modelHint: 'claude-3-5-haiku-latest', // just a hint to the backend
  systemPrompt: 'You are Atlas, an empathetic EQ coach.',
};

export const SUPABASE = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anon: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};

export const FLAGS = {
  enableRitualBuilder: true,
  enableHabitTracker: true,
  enablePersonalReflections: false,
  enableOralPrep: false,
  enableEQVoice: false,
  enableDailyChallenges: true,
};
