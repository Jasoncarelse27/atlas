// cicd-alert Supabase Edge Function
// Sends CI/CD alerts via MailerSend with environment-based routing

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("MAILERSEND_API_TOKEN");
    if (!token) {
      console.error("Missing MAILERSEND_API_TOKEN in environment");
      return new Response(
        JSON.stringify({ error: "MAILERSEND_API_TOKEN not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { env, message } = await req.json();

    // Default recipient: staging/test
    let recipient = "test-alerts@otiumcreations.com";
    if (env === "production") {
      recipient = "admin@otiumcreations.com";
    }

    const body = {
      from: { email: "alerts@otiumcreations.com", name: "Atlas CI/CD Alerts" },
      to: [{ email: recipient }],
      subject: `[Atlas CI/CD Alert] ${env ?? "staging"}`,
      text: message ?? "No message provided",
    };

    console.log("📧 Sending email:", body);

    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("MailerSend error:", errorText);
      return new Response(
        JSON.stringify({ error: "MailerSend API error", details: errorText }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Email sent successfully");
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});