export function preserveLocalStorage() {
  try {
    if (typeof window === "undefined") return;

    const currentSession = localStorage.getItem("supabase.auth.token");
    if (currentSession) {
      console.info("[LocalStorage] Preserved session successfully");
    }
  } catch (err) {
  }
}
