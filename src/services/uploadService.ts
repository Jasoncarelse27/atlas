import { supabase } from "@/lib/supabase";

export async function uploadWithAuth(file: File, feature: string, userId: string) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("No auth token");

  const form = new FormData();
  form.append("file", file);
  form.append("feature", feature);
  form.append("userId", userId);

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const res = await fetch(`${backendUrl}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed: ${res.status} ${errorText}`);
  }
  
  return res.json(); // {url}
}
