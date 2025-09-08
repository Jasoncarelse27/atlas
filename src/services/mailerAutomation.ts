import { sendEmailViaMailerLite } from "./mailerLiteAdapter";

type FlowResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

const FROM_DEFAULT =
  process.env.MAILER_FROM || "Atlas <no-reply@atlas.local>";
const APP_URL = process.env.PUBLIC_APP_URL || "http://localhost:5173";

export async function sendWelcomeEmail(email: string): Promise<FlowResult> {
  const html = `
    <h1>Welcome to Atlas</h1>
    <p>Your workspace is ready. Start here: <a href="${APP_URL}">${APP_URL}</a></p>
  `;
  return sendEmailViaMailerLite({
    to: email,
    subject: "Welcome to Atlas",
    html,
    from: FROM_DEFAULT,
    tags: ["welcome"],
  });
}

export async function sendUpgradeNudge(email: string, usage: number): Promise<FlowResult> {
  const html = `
    <h1>You're crushing it</h1>
    <p>You've used ${usage}% of your plan. Upgrade for more headroom.</p>
  `;
  return sendEmailViaMailerLite({
    to: email,
    subject: "Your usage is spiking – upgrade for more",
    html,
    from: FROM_DEFAULT,
    tags: ["upgrade_nudge"],
  });
}

export async function sendInactivityReminder(email: string, lastActiveISO: string): Promise<FlowResult> {
  const html = `
    <h1>We miss you</h1>
    <p>Last activity: ${new Date(lastActiveISO).toLocaleString()}</p>
  `;
  return sendEmailViaMailerLite({
    to: email,
    subject: "Come back to Atlas",
    html,
    from: FROM_DEFAULT,
    tags: ["inactivity_reminder"],
  });
}

export async function sendWeeklySummary(
  email: string,
  summary: { messages: number; highlights: string[] },
): Promise<FlowResult> {
  const items = summary.highlights.map(h => `<li>${h}</li>`).join("");
  const html = `
    <h1>Your Atlas Weekly Summary</h1>
    <p>Messages: ${summary.messages}</p>
    <ul>${items}</ul>
  `;
  return sendEmailViaMailerLite({
    to: email,
    subject: "Your weekly summary",
    html,
    from: FROM_DEFAULT,
    tags: ["weekly_summary"],
  });
}
