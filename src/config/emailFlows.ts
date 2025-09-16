// src/config/emailFlows.ts
export const EMAIL_FLOWS = {
  welcome: {
    subject: "Welcome to Atlas AI 🌱",
    templateId: "atlas-welcome-template",
  },
  upgrade: {
    subject: "🎉 Thanks for upgrading!",
    templateId: "atlas-upgrade-template",
  },
  inactivity: {
    subject: "We miss you at Atlas 💭",
    templateId: "atlas-inactivity-template",
  },
  weeklySummary: {
    subject: "📊 Your Atlas Weekly Insights",
    templateId: "atlas-weekly-template",
  },
} as const;

export type EmailFlow = keyof typeof EMAIL_FLOWS;
