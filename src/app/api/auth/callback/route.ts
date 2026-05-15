import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth/safe-redirect";

/**
 * Auth callback for magic link / OAuth flows.
 *
 * IMPORTANT: in Route Handlers, cookies() from next/headers is read-only and
 * `cookieStore.set()` does NOT persist to the outgoing response. The session
 * cookies set by Supabase via exchangeCodeForSession() must be attached to
 * the NextResponse explicitly.
 *
 * Hardening:
 * - `next` query param is sanitized with `safeNextPath()` (T-v025-08 open
 *   redirect): rejects `//`, `\\`, control chars, and non-absolute paths.
 * - The cookie `domain` option from Supabase is stripped (T-v025-01) so the
 *   browser scopes cookies to the current Host header only — same hardening
 *   the proxy/middleware layer applies in `src/lib/supabase/proxy-client.ts`.
 *   Without this, the initial session cookie set on callback would land under
 *   `domain=.impluxa.com` and leak across tenant subdomains.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

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
              response.cookies.set(name, value);
              continue;
            }
            const { domain: _drop, ...rest } = options as Record<
              string,
              unknown
            > & { domain?: string };
            void _drop;
            response.cookies.set(
              name,
              value,
              rest as Parameters<typeof response.cookies.set>[2],
            );
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return response;
}
