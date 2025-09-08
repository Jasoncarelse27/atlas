import { describe, it, expect, vi } from "vitest";
import { sendEmailViaMailerLite } from "@/services/mailerLiteAdapter";

describe("Mailer adapter guard", () => {
  it("short-circuits when DRY_RUN is true", async () => {
    vi.stubEnv("EMAIL_DRY_RUN", "true");
    vi.stubEnv("EMAIL_LIVE_MODE", "true");
    const res = await sendEmailViaMailerLite({
      to: "not-allowed@example.com",
      subject: "x",
      html: "<b>x</b>",
    });
    expect(res.success).toBe(true);
    vi.unstubAllEnvs();
  });

  it("allows real send only when live + in allowlist", async () => {
    vi.stubEnv("EMAIL_DRY_RUN", "false");
    vi.stubEnv("EMAIL_LIVE_MODE", "true");
    vi.stubEnv("EMAIL_ALLOWLIST", "qa@yourco.com,@yourco.com");
    const res = await sendEmailViaMailerLite({
      to: "qa@yourco.com",
      subject: "x",
      html: "<b>x</b>",
    });
    expect(res.success).toBe(true); // MSW mocks network
    vi.unstubAllEnvs();
  });
});
