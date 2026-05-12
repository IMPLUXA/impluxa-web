import * as Sentry from "@sentry/nextjs";

const PII_KEYS = ["email", "phone", "password"] as const;

function scrubObject<T extends Record<string, unknown> | undefined>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of PII_KEYS) {
    if (key in obj) delete (obj as Record<string, unknown>)[key];
  }
  return obj;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    scrubObject(event.user as Record<string, unknown> | undefined);
    scrubObject(event.extra as Record<string, unknown> | undefined);
    if (event.contexts) {
      for (const ctxKey of Object.keys(event.contexts)) {
        scrubObject(
          event.contexts[ctxKey] as Record<string, unknown> | undefined,
        );
      }
    }
    if (event.request?.data && typeof event.request.data === "object") {
      scrubObject(event.request.data as Record<string, unknown>);
    }
    if (Array.isArray(event.breadcrumbs)) {
      for (const bc of event.breadcrumbs) {
        if (bc.data) scrubObject(bc.data as Record<string, unknown>);
      }
    }
    return event;
  },
});
