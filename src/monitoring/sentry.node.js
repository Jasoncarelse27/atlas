/* eslint-env node */
import * as Sentry from "@sentry/node";

export function initSentry() {
  if (!process.env.SENTRY_DSN_API) return;
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN_API,
    environment: process.env.SENTRY_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

export { Sentry };
