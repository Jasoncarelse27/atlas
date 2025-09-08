/**
 * Minimal MailerLite adapter.
 * In tests, MSW intercepts these HTTP calls (no real network).
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  tags?: string[];
};

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

const MAILERLITE_ENDPOINT = "https://api.mailerlite.com/api/v2/email/send";

function parseAllowlist(raw?: string): Set<string> {
  if (!raw) return new Set();
  return new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

function allowlistIncludes(email: string, allow: Set<string>): boolean {
  const e = email.toLowerCase();
  return allow.has(e) || [...allow].some(x => x.startsWith('@') ? e.endsWith(x) : false);
}

export async function sendEmailViaMailerLite(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  try {
    const live = (process.env.EMAIL_LIVE_MODE ?? "false").toString() === "true";
    const dryRun = (process.env.EMAIL_DRY_RUN ?? "false").toString() === "true";
    const allow = parseAllowlist(process.env.EMAIL_ALLOWLIST);

    if (dryRun || !live || (allow.size && !allowlistIncludes(input.to, allow))) {
      // Pretend success, never call the network
      return { success: true, messageId: "dry-run-" + Date.now().toString() };
    }
    const apiKey = process.env.MAILERLITE_API_KEY || "test-key";
    const res = await fetch(MAILERLITE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MailerLite-ApiKey": apiKey,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `MailerLite ${res.status}: ${text}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { success: true, messageId: data.id ?? "test-message-id" };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}
