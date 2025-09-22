// supabase/functions/feature-nudge/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MAILERLITE_API_KEY = Deno.env.get("MAILERLITE_API_KEY")!;
const MAILERLITE_GROUP_ID = Deno.env.get("MAILERLITE_UPGRADE_GROUP_ID")!; // group/tag for upgrade nudges

serve(async (req: Request) => {
  try {
    const { record } = await req.json();

    // Only trigger on failed attempts (Free tier user hitting premium features)
    if (!record || record.success === true) {
      return new Response("Ignored (success attempt)", { status: 200 });
    }

    console.log("[Feature-Nudge] Triggered for user:", record.user_id);

    // Fetch user email from Supabase profiles
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { data: profile, error } = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${record.user_id}`,
      {
        headers: {
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        },
      }
    ).then((res) => res.json());

    if (error || !profile?.[0]) {
      console.error("[Feature-Nudge] No profile found:", error);
      return new Response("Profile not found", { status: 404 });
    }

    const email = profile[0].email;
    console.log("[Feature-Nudge] Found email:", email);

    // Add subscriber to MailerLite upgrade group
    const res = await fetch(`https://connect.mailerlite.com/api/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MAILERLITE_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        groups: [MAILERLITE_GROUP_ID],
        fields: {
          feature: record.feature,
          tier: "free",
        },
      }),
    });

    if (!res.ok) {
      console.error("[MailerLite] Error:", await res.text());
      return new Response("MailerLite error", { status: 500 });
    }

    console.log("[MailerLite] Upgrade nudge sent for:", email);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Feature-Nudge] Error:", err);
    return new Response("Error", { status: 500 });
  }
});
