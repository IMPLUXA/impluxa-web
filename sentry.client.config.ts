import * as Sentry from "@sentry/nextjs";
import { scrub } from "./src/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
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
