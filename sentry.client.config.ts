import * as Sentry from "@sentry/nextjs";
import { scrub } from "./src/lib/sentry-scrub";

// NOTE: enableLogs flag here is cosmetic / future-proof until the
// instrumentation.ts register() pipeline is repaired (Next.js 16 +
// Turbopack constraint). Effective Sentry.logger usage today requires
// inline Sentry.init({ enableLogs: true }) at the call site.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enableLogs: true,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    scrub(event.user);
    scrub(event.extra);
    scrub(event.contexts);
    scrub(event.request);
    scrub(event.breadcrumbs);
    return event;
  },
});
