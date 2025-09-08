import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN_WEB) {
  Sentry.init({
    dsn: (import.meta as any).env.VITE_SENTRY_DSN || process.env.SENTRY_DSN_WEB,
    environment: process.env.SENTRY_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.2),
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration?.()].filter(Boolean) as any,
  });
}

export { Sentry };
