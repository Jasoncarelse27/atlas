import { db } from "@/lib/conversationStore";
import { supabase } from "@/lib/supabase";

export async function syncPendingUploads() {
  const pending = await db.pendingUploads.where("status").equals("pending").toArray();
  if (!pending.length) return;

  console.log(`📂 Found ${pending.length} pending uploads, syncing...`);

  const synced: string[] = [];
  const failed: string[] = [];

  for (const item of pending) {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("No auth token");

      // Send to your existing backend route – it already handles auth + storage
      const form = new FormData();
      form.append("file", item.blob, item.fileName);
      form.append("feature", item.type);
      if (item.conversationId) form.append("conversationId", item.conversationId);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      const result = await res.json();

      // Also ingest to attachments table
      await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: item.userId,
          conversationId: item.conversationId,
          feature: item.type,
          url: result.url,
          contentType: item.contentType,
          size: item.blob.size,
        }),
      });

      await db.pendingUploads.update(item.id!, { status: "sent", updatedAt: Date.now() });
      synced.push(item.fileName);
      console.log(`✅ Synced upload: ${item.fileName}`);
    } catch (err) {
      // Leave as "pending" for cron/edge retry to pick up later
      failed.push(item.fileName);
      console.warn(`[syncPendingUploads] retry later for ${item.fileName}:`, err);
    }
  }

  // 🔔 Trigger Edge Function retry as a safety net
  try {
    const { data, error } = await supabase.functions.invoke("retryFailedUploads", {
      method: "POST",
      body: { trigger: "dexie-sync" },
    });
    if (error) throw error;
    console.log("🔄 Server-side retry triggered:", data);
  } catch (err) {
    console.error("⚠️ Failed to trigger server retry:", err);
  }

  // 📊 Log the sync attempt
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("retry_logs").insert({
      user_id: user?.id || null,
      source: "dexie-sync",
      attempted_count: pending.length,
      success_count: synced.length,
      failed_count: failed.length,
      file_type: "audio", // Since this handles audio uploads
      details: { synced, failed },
    });
    console.log("📊 Logged dexie-sync attempt");
  } catch (err) {
    console.error("⚠️ Failed to log sync attempt:", err);
  }
}

// Helper function to test backend connection
export async function testBackendConnection(): Promise<boolean> {
  try {
    const response = await fetch("/ping", { 
      method: "GET",
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return response.ok;
  } catch (err) {
    console.warn("Backend connection test failed:", err);
    return false;
  }
}
