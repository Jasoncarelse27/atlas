// supabase/functions/cicd-alert/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    console.log("📩 Incoming CI/CD alert request");

    const { environment = "staging", message = "No message" } = await req.json();

    // Import environment secret
    const apiKey = Deno.env.get("MAILERSEND_API_TOKEN");
    if (!apiKey) {
      console.error("❌ Missing MAILERSEND_API_TOKEN in Supabase Vault");
      return new Response("Missing MAILERSEND_API_TOKEN", { status: 500 });
    }

    // Decide recipient based on environment
    const recipient =
      environment === "production"
        ? "admin@otiumcreations.com"
        : "test-alerts@otiumcreations.com";

    console.log(`📧 Sending CI/CD alert to ${recipient} in ${environment}`);

    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: "alerts@otiumcreations.com",
          name: "Atlas CI/CD Alerts",
        },
        to: [{ email: recipient }],
        subject: `[${environment.toUpperCase()}] CI/CD Alert`,
        text: message || `CI/CD Alert triggered in ${environment}`,
      }),
    });

    const text = await res.text();
    console.log("📨 MailerSend response:", text);

    if (!res.ok) {
      console.error(`❌ MailerSend error: ${res.status} - ${text}`);
      return new Response(`MailerSend error: ${res.status}`, { status: 500 });
    }

    console.log(`✅ Email sent successfully to ${recipient}`);
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("🔥 Function error:", err.message);
    return new Response("Internal Server Error", { status: 500 });
  }
});