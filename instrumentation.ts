// KNOWN CONSTRAINT (Next.js 16 + Turbopack): register() hook does not
// auto-load sentry.{server,edge}.config in this runtime — empirically
// verified across multiple verify attempts (B2 sesion 2026-05-24).
// Runtime capture currently relies on inline Sentry.init() inside route
// handlers (R1-style pattern, see Fix #2). This file is kept canonical
// for build plugin detection + future-proof for when the instrumentation
// pipeline is repaired (backlog: middleware -> proxy migration).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Hybrid: top-level Sentry import (so build plugin detects instrumentation
// file) + wrapper that adds explicit flush(2000) (SDK auto-flush via
// vercelWaitUntil did not work alone — verified empirically R3FIX).
export const onRequestError: typeof Sentry.captureRequestError = async (
  ...args
) => {
  Sentry.captureRequestError(...args);
  await Sentry.flush(2000);
};
