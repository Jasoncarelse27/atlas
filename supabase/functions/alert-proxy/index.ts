import { serve } from "https://deno.land/std/http/server.ts"

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL")!
const CICD_ALERT_TOKEN = Deno.env.get("CICD_ALERT_TOKEN")!

serve(async (req) => {
  try {
    // ✅ Verify Authorization
    const authHeader = req.headers.get("authorization")
    if (!authHeader || authHeader !== `Bearer ${CICD_ALERT_TOKEN}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // ✅ Parse JSON payload from GitHub
    const body = await req.json()

    // ✅ Forward to Slack
    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!slackRes.ok) {
      throw new Error(`Slack responded with ${slackRes.status}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
