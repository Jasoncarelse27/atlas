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
    console.log("📧 Received request:", { env, message, tokenLength: token.length });

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

    console.log("📧 Sending email to:", recipient, "in environment:", env);

    try {
      const res = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("MAILERSEND_API_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { email: "alerts@otiumcreations.com" },
          to: [{ email: recipient }],
          subject: `[Atlas CI/CD Alert] ${env ?? "staging"}`,
          text: message || "No message provided",
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("MailerSend API Error:", errorText);
        return new Response(
          JSON.stringify({ status: "error", details: errorText }),
          { status: 500 }
        );
      }

      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    } catch (err) {
      console.error("Function error:", err.message);
      return new Response(
        JSON.stringify({ status: "error", details: err.message }),
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});