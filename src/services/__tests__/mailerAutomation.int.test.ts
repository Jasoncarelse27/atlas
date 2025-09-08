import { describe, it, expect } from "vitest";
import {
  sendWelcomeEmail,
  sendUpgradeNudge,
  sendInactivityReminder,
  sendWeeklySummary,
} from "@/services/mailerAutomation";

describe("Mailer Automation (Phase 6)", () => {
  it("sends welcome email", async () => {
    const res = await sendWelcomeEmail("u@example.com");
    expect(res.success).toBe(true);
  });

  it("sends upgrade nudge", async () => {
    const res = await sendUpgradeNudge("u@example.com", 92);
    expect(res.success).toBe(true);
  });

  it("sends inactivity reminder", async () => {
    const res = await sendInactivityReminder("u@example.com", "2024-06-01T10:00:00Z");
    expect(res.success).toBe(true);
  });

  it("sends weekly summary", async () => {
    const res = await sendWeeklySummary("u@example.com", {
      messages: 42,
      highlights: ["Top conversation A", "Top conversation B"],
    });
    expect(res.success).toBe(true);
  });
});
