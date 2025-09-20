import { supabase } from "../lib/supabaseClient";

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get current Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    console.warn("No auth token found, user may need to log in");
    throw new Error("No valid auth token found. Please log in again.");
  }

  console.log(`[fetchWithAuth] Making authenticated request to: ${url}`);
  
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  // Global 401 handler
  if (res.status === 401) {
    console.error("Authentication failed, token may be expired");
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("Session expired, redirecting to login.");
  }

  if (!res.ok) {
    console.error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return res;
}

// Helper for JSON responses
export async function fetchWithAuthJSON(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetchWithAuth(url, options);
  return response.json();
}
