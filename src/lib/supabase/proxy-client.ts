import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export type HostScope = "auth" | "app" | "admin";

/**
 * Refresh the Supabase session inside the proxy/middleware layer.
 *
 * Bound to `req.cookies.getAll` (incoming) and `res.cookies.set` (outgoing),
 * with one critical hardening: ANY `domain` option passed by Supabase is
 * stripped before writing the cookie. This enforces host-only cookie scope
 * so a session minted at `auth.impluxa.com` does NOT leak to tenant
 * subdomains (`hakuna.impluxa.com`) or vice-versa.
 *
 * Why drop `domain`: under `@supabase/ssr` default options, cookies can land
 * with `domain=.impluxa.com` which makes them visible across every subdomain.
 * Combined with tenant-rendered content potentially serving stored XSS,
 * that's an account-takeover vector (T-v025-01). Host-only cookies neutralize
 * the entire class.
 *
 * `hostScope` is reserved for a future migration where cookie names get
 * per-host suffixes (e.g. `sb-auth-access-token` vs `sb-app-access-token`)
 * to allow simultaneous distinct sessions per host. Today it's a no-op param
 * on the public API to lock the contract early.
 *
 * Implements W3.G7.T3 (FR-AUTH-2, ADR-0005 §6).
 */
export async function updateSession(
  req: NextRequest,
  res: NextResponse,
  _hostScope: HostScope,
): Promise<void> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            if (options === undefined) {
              res.cookies.set(name, value);
              continue;
            }
            // Strip `domain` so the browser scopes the cookie to the
            // current Host header only. Preserve every other option
            // (path, httpOnly, secure, sameSite, maxAge, expires, ...).
            const { domain: _dropDomain, ...rest } = options as Record<
              string,
              unknown
            > & { domain?: string };
            void _dropDomain;
            res.cookies.set(
              name,
              value,
              rest as Parameters<typeof res.cookies.set>[2],
            );
          }
        },
      },
    },
  );

  // Touches the auth subsystem so refresh-on-read kicks in and the rotated
  // tokens flow back through setAll() above. Result intentionally discarded.
  await supabase.auth.getClaims();
}
