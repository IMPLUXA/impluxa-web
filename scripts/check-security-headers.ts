#!/usr/bin/env tsx
/**
 * scripts/check-security-headers.ts
 *
 * Curls a URL and asserts the response carries production security headers:
 *   - Content-Security-Policy
 *   - Strict-Transport-Security
 *   - X-Frame-Options
 *   - X-Content-Type-Options
 *   - Referrer-Policy
 *   - Permissions-Policy
 *
 * Also asserts CSP includes Sentry origins after C1 (sentry.io, ingest.sentry.io).
 *
 * Usage:
 *   npx tsx scripts/check-security-headers.ts https://hakunamatata.impluxa.com
 *   npx tsx scripts/check-security-headers.ts https://impluxa.com --require-sentry
 *
 * Exit codes:
 *   0 — all required headers present
 *   1 — at least one missing
 *   2 — fetch error
 */

const REQUIRED = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

async function main() {
  const url = process.argv[2];
  const requireSentry = process.argv.includes("--require-sentry");

  if (!url) {
    console.error("Usage: check-security-headers <url> [--require-sentry]");
    process.exit(2);
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "HEAD", redirect: "manual" });
  } catch (e) {
    console.error(`✗ fetch failed: ${(e as Error).message}`);
    process.exit(2);
  }

  const headers = Object.fromEntries(
    [...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]),
  );

  let failed = false;
  console.log(`security-headers check  ${url}  status=${res.status}`);

  for (const h of REQUIRED) {
    const v = headers[h];
    if (!v) {
      console.error(`  ✗ missing: ${h}`);
      failed = true;
    } else {
      console.log(`  ✓ ${h}: ${v.slice(0, 80)}${v.length > 80 ? "..." : ""}`);
    }
  }

  if (requireSentry) {
    const csp = headers["content-security-policy"] ?? "";
    if (!/sentry\.io/.test(csp)) {
      console.error(
        "  ✗ CSP does not whitelist sentry.io (use --require-sentry only post-C1)",
      );
      failed = true;
    } else {
      console.log("  ✓ CSP whitelists Sentry origins");
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log("✓ check-security-headers: all required headers present");
  process.exit(0);
}

main().catch((err) => {
  console.error("script error:", err);
  process.exit(2);
});
