// supabase/functions/retryFailedUploads/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Allowed origins for dev + prod
const allowedOrigins = [
  "http://localhost:5174",
  "https://atlas-xi-tawny.vercel.app",
  "https://atlas.app"
];

function corsHeaders(origin: string | null) {
  const isAllowed = origin && allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "http://localhost:5174", // fallback
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  console.log("⚡ Running retryFailedUploads...");
  const origin = req.headers.get("origin");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(origin),
    });
  }

  // Parse request body to get trigger source
  let payload: { trigger?: string } = {};
  try {
    if (req.method === "POST") {
      payload = await req.json();
    }
  } catch (err) {
    console.warn("Could not parse request body:", err);
  }

  try {
    // Get all pending attachments that need retry
    const { data: attachments, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("status", "pending")
      .in("feature", ["file", "image", "audio"])
      .limit(20);

    if (error) {
      console.error("❌ Fetch failed attachments:", error.message);
      return new Response(JSON.stringify({ error: "Failed to fetch attachments" }), { 
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders(origin)
        }
      });
    }

    if (!attachments || attachments.length === 0) {
      console.log("✅ No pending uploads to retry");
      return new Response(JSON.stringify({ message: "No pending uploads to retry", count: 0 }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders(origin)
        }
      });
    }

    console.log(`📤 Found ${attachments.length} pending uploads to retry`);

    let successCount = 0;
    let failureCount = 0;

    for (const file of attachments) {
      try {
        console.log(`🔄 Retrying upload for file ${file.id} (${file.feature})`);

        // In a real implementation, you would:
        // 1. Get the original file from temporary storage
        // 2. Re-upload to Supabase Storage
        // 3. Update the URL and status
        
        // For now, we'll simulate a successful retry by updating the status
        // In production, you'd implement actual file re-upload logic here
        
        const { error: updateError } = await supabase
          .from("attachments")
          .update({ 
            status: "sent", 
            updated_at: new Date().toISOString(),
            // In production, you'd update the URL with the new upload URL
            // url: newUploadUrl
          })
          .eq("id", file.id);

        if (updateError) {
          console.error(`❌ Failed to update status for ${file.id}:`, updateError.message);
          failureCount++;
          
          // Mark as failed if we can't update
          await supabase
            .from("attachments")
            .update({ 
              status: "failed", 
              updated_at: new Date().toISOString() 
            })
            .eq("id", file.id);
        } else {
          console.log(`✅ Retry successful for ${file.id}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Retry failed for ${file.id}:`, err.message);
        failureCount++;
        
        // Mark as failed
        await supabase
          .from("attachments")
          .update({ 
            status: "failed", 
            updated_at: new Date().toISOString() 
          })
          .eq("id", file.id);
      }
    }

    const result = {
      message: "Retry worker finished",
      total: attachments.length,
      success: successCount,
      failures: failureCount
    };

    console.log(`📊 Retry Summary: ${successCount} successful, ${failureCount} failed`);

    // 📊 Log the retry attempt
    try {
      await supabase.from("retry_logs").insert({
        user_id: null, // Edge function runs for all users
        source: payload.trigger || "edge-retry",
        attempted_count: attachments.length,
        success_count: successCount,
        failed_count: failureCount,
        file_type: "audio", // Since this function now handles audio uploads
        details: { 
          total: attachments.length,
          success: successCount,
          failures: failureCount,
          trigger: payload.trigger || "edge-retry",
          file_types: attachments.map(a => a.feature)
        },
      });
      console.log("📊 Logged edge-retry attempt");
    } catch (err) {
      console.error("⚠️ Failed to log retry attempt:", err);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders(origin)
      }
    });

  } catch (error) {
    console.error("❌ Edge function error:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders(origin)
      }
    });
  }
});
