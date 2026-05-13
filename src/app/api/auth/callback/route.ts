import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth callback for magic link / OAuth flows.
 *
 * IMPORTANT: in Route Handlers, cookies() from next/headers is read-only and
 * `cookieStore.set()` does NOT persist to the outgoing response. The session
 * cookies set by Supabase via exchangeCodeForSession() must be attached to
 * the NextResponse explicitly.
 *
 * The previous implementation used the shared getSupabaseServerClient() which
 * relies on cookies() and silently swallows the write error in a try/catch.
 * Result: exchange succeeded server-side, but the browser never received the
 * session cookie -> the user landed back on /login.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

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
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
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
