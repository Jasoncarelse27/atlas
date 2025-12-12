// supabase/functions/escalation-monitor/index.ts
// Escalation Monitor Edge Function - Cron-safe critical issue detection
// Designed to run periodically (every 5-15 minutes) without duplicating incidents

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const backendApiUrl = Deno.env.get("BACKEND_API_URL") || "http://localhost:8000";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request) => {
  try {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Verify this is a cron trigger or admin request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EscalationMonitor] Running critical issue detection...");

    // Call backend escalation detection endpoint
    const backendResponse = await fetch(`${backendApiUrl}/api/agents/escalation/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader, // Forward auth header
      },
      body: JSON.stringify({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
        sources: ["web", "social", "email"]
      })
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error("[EscalationMonitor] Backend error:", errorText);
      return new Response(
        JSON.stringify({ error: "Backend detection failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await backendResponse.json();

    console.log("[EscalationMonitor] Detection complete:", {
      incidentsCreated: result.incidentsCreated
    });

    return new Response(
      JSON.stringify({
        ok: true,
        incidentsCreated: result.incidentsCreated || 0,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EscalationMonitor] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});










