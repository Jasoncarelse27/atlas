// supabase/functions/cicd-alert/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    console.log("📩 Incoming CI/CD alert request");

    // Check for Bearer token authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid authorization header");
      return new Response("Unauthorized: Missing Bearer token", { status: 401 });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    console.log("✅ Bearer token received:", token.substring(0, 20) + "...");

    const payload = await req.json();
    console.log("🔍 Parsed payload:", JSON.stringify(payload, null, 2));

    // Extract environment and determine recipient
    const environment = payload.environment || "staging";
    const recipient = environment === "production" 
      ? "admin@otiumcreations.com" 
      : "test-alerts@otiumcreations.com";
    
    console.log(`📧 Sending CI/CD alert to ${recipient} in ${environment}`);

    // Simulate email sending (MailerLite or custom sendEmail)
    try {
      console.log("📨 Attempting to send email via MailerLite...");
      const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("MAILERLITE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: recipient,
          fields: {
            name: "CI/CD Alert",
          },
          groups: [],
        }),
      });

      const text = await res.text();
      console.log("📬 MailerLite response:", text);

      if (!res.ok) {
        throw new Error(`MailerLite error: ${res.status} - ${text}`);
      }

      console.log(`✅ Email sent successfully to ${recipient}`);
    } catch (emailErr) {
      console.error("❌ Email sending failed:", emailErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true, message: "CI/CD alert processed" }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    console.error("🔥 Function error:", err.message);
    return new Response("Internal Server Error", { status: 500 });
  }
});