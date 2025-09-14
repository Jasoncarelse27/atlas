// supabase/functions/cicd-alert/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    console.log("📩 Incoming CI/CD alert request");

    const payload = await req.json();
    console.log("🔍 Parsed payload:", JSON.stringify(payload, null, 2));

    // Validate secret
    const signature = req.headers.get("x-mailerlite-signature");
    if (!signature) {
      console.error("❌ Missing signature header");
      return new Response("Missing signature", { status: 401 });
    }

    console.log("✅ Signature received:", signature);

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
          email: "admin@otiumcreations.com",
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

      console.log("✅ Email sent successfully to admin@otiumcreations.com");
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