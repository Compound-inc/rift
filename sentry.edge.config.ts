// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Helper function to check if event contains middleware POST spans
function isMiddlewarePost(event: { spans?: Array<{ op?: string; description?: string }> }): boolean {
  return event.spans?.some(
    (span) =>
      span.op === "http.server.middleware" &&
      span.description?.includes("POST")
  ) ?? false;
}

Sentry.init({
  dsn: "https://0894cb8fa1966df202121a2e5c5f3f6b@o4510584741298176.ingest.us.sentry.io/4510584746147840",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Filter out middleware POST requests
  beforeSend(event) {
    return isMiddlewarePost(event) ? null : event;
  },

  // Filter out middleware POST transactions
  beforeSendTransaction(event) {
    return isMiddlewarePost(event) ? null : event;
  },
});
