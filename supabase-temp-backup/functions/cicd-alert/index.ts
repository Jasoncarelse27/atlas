// supabase/functions/cicd-alert/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  return new Response(
    JSON.stringify({ ok: true, message: "CI/CD alert function is working!" }),
    { headers: { "Content-Type": "application/json" } }
  );
});