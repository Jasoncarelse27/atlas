// supabase/functions/social-fetcher/index.ts
// Social Fetcher Edge Function - Cron-safe social media polling
// Fetches comments from Facebook, Instagram, YouTube and processes them

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

    const platforms = ["facebook", "instagram", "youtube"];
    const results = [];

    console.log("[SocialFetcher] Fetching social media comments...");

    // Fetch from each platform
    for (const platform of platforms) {
      try {
        console.log(`[SocialFetcher] Processing ${platform}...`);

        // Call backend social agent endpoint
        const backendResponse = await fetch(`${backendApiUrl}/api/agents/social/fetch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader, // Forward auth header
          },
          body: JSON.stringify({
            platform: platform,
            since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
          })
        });

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text();
          console.error(`[SocialFetcher] ${platform} error:`, errorText);
          results.push({
            platform,
            ok: false,
            error: errorText
          });
          continue;
        }

        const result = await backendResponse.json();
        results.push({
          platform,
          ok: true,
          processed: result.processed || 0,
          insights: result.insights || []
        });

        console.log(`[SocialFetcher] ${platform} complete:`, {
          processed: result.processed
        });

      } catch (error) {
        console.error(`[SocialFetcher] Error processing ${platform}:`, error);
        results.push({
          platform,
          ok: false,
          error: error.message
        });
      }
    }

    const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);

    return new Response(
      JSON.stringify({
        ok: true,
        platforms: results,
        totalProcessed,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SocialFetcher] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});


