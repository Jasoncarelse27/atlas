export const isAuthBypass =
  process.env.EXPO_PUBLIC_AUTH_BYPASS === 'true' &&
  process.env.EXPO_PUBLIC_ENV !== 'production';

export function getBypassUser() {
  if (!isAuthBypass) return null;
  return {
    id: process.env.EXPO_PUBLIC_SEED_USER_ID || 'dev-user-001',
    email: 'dev@atlas.local',
  };
}
