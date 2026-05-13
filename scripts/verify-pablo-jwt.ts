#!/usr/bin/env tsx
/**
 * scripts/verify-pablo-jwt.ts
 *
 * Verifies Pablo's auth state for v0.3.0 B4 (manual step requires Pablo to be logged in).
 * Hits /api/whoami with Pablo's session cookie (read from a local file or env var).
 *
 * Asserts:
 *   - response.app_metadata.role === 'admin'
 *   - response.tenants includes { slug: 'hakunamatata', role: 'owner' }
 *
 * Usage:
 *   - Pablo logs in at app.impluxa.com (or localhost:3000 with host override)
 *   - Pablo opens DevTools → Application → Cookies → copy `sb-<project>-auth-token` value
 *   - Set: $env:PABLO_SESSION_COOKIE = "<copied value>"
 *   - Run: npx tsx scripts/verify-pablo-jwt.ts http://localhost:3000
 *   - Or: npx tsx scripts/verify-pablo-jwt.ts https://app.impluxa.com
 *
 * Exit codes:
 *   0 — JWT verified
 *   1 — assertion failed
 *   2 — fetch or config error
 *
 * NOTE: /api/whoami endpoint is created in task B4. Until then this script exits 2.
 */

async function main() {
  const baseUrl = process.argv[2] ?? "http://localhost:3000";
  const cookie = process.env.PABLO_SESSION_COOKIE;
  if (!cookie) {
    console.error(
      "✗ PABLO_SESSION_COOKIE not set. Copy sb-<project>-auth-token from DevTools and set env var.",
    );
    process.exit(2);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/whoami`, {
      headers: { cookie: `sb-auth-token=${cookie}` },
    });
  } catch (e) {
    console.error(`✗ fetch failed: ${(e as Error).message}`);
    process.exit(2);
  }

  if (res.status === 404) {
    console.error(
      "✗ /api/whoami returns 404 — endpoint not yet created (B4 task pending)",
    );
    process.exit(2);
  }
  if (!res.ok) {
    console.error(`✗ /api/whoami status ${res.status}`);
    process.exit(1);
  }

  const data = (await res.json()) as {
    user_id?: string;
    email?: string;
    app_metadata?: { role?: string };
    tenants?: Array<{ slug: string; role: string }>;
  };

  console.log("whoami response:", JSON.stringify(data, null, 2));

  const role = data.app_metadata?.role;
  if (role !== "admin") {
    console.error(`✗ app_metadata.role = ${role} (expected 'admin')`);
    console.error(
      "  → Pablo must sign out and re-login after SQL UPDATE to refresh JWT",
    );
    process.exit(1);
  }

  const hakuna = data.tenants?.find((t) => t.slug === "hakunamatata");
  if (!hakuna) {
    console.error(
      "✗ Pablo not a member of hakunamatata tenant. Check tenant_members table.",
    );
    process.exit(1);
  }
  if (hakuna.role !== "owner") {
    console.error(
      `✗ Pablo is member of hakunamatata but role = ${hakuna.role} (expected 'owner')`,
    );
    process.exit(1);
  }

  console.log("✓ verify-pablo-jwt: admin role + hakunamatata owner confirmed");
  process.exit(0);
}

main().catch((err) => {
  console.error("script error:", err);
  process.exit(2);
});
