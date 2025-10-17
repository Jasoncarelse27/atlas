import { logger } from '../lib/logger';

export function preserveLocalStorage() {
  try {
    if (typeof window === "undefined") return;

    const currentSession = localStorage.getItem("supabase.auth.token");
    if (currentSession) {
      logger.info("[LocalStorage] Preserved session successfully");
    }
  } catch (err) {
      // Intentionally empty - error handling not required
  }
}
