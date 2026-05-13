import { NextRequest, NextResponse } from "next/server";
import createNextIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getMonitoringLimiter } from "./lib/ratelimit";

const intlMiddleware = createNextIntlMiddleware(routing);

const MARKETING_HOSTS = new Set([
  "impluxa.com",
  "www.impluxa.com",
  "localhost:3000",
]);
const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "app.impluxa.com";
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST ?? "admin.impluxa.com";
const TENANT_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? ".impluxa.com";

// cyber-neo F6: cap Sentry tunnel payload + rate-limit to protect quota.
const MONITORING_MAX_BYTES = 1_000_000; // 1 MB

async function guardMonitoring(req: NextRequest): Promise<NextResponse | null> {
  if (req.nextUrl.pathname !== "/monitoring") return null;
  if (req.method !== "POST") return null;

  // Operator killswitch — flip when Sentry quota approaches limit.
  if (process.env.SENTRY_TUNNEL_DISABLED === "true") {
    return new NextResponse("tunnel disabled", { status: 503 });
  }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MONITORING_MAX_BYTES) {
    return new NextResponse("payload too large", { status: 413 });
  }

  const limiter = getMonitoringLimiter();
  if (limiter) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const { success } = await limiter.limit(`mon:${ip}`);
    if (!success) {
      return new NextResponse("rate limited", { status: 429 });
    }
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const blocked = await guardMonitoring(req);
  if (blocked) return blocked;

  const host = (req.headers.get("host") ?? "").toLowerCase();

  // Marketing site: delegate to next-intl (handles /es /en locale routing)
  if (MARKETING_HOSTS.has(host)) {
    return intlMiddleware(req);
  }

  const url = req.nextUrl.clone();

  // Shared root-level paths that exist at /<path> (not /<host-prefix>/<path>):
  // login, signup, auth callback, APIs, monitoring tunnel, static metadata.
  // These must NOT be rewritten under the host-specific prefix.
  const SHARED_ROOT =
    /^\/(login|signup|api|monitoring|robots\.txt|sitemap\.xml)(\/|$)/;
  if (SHARED_ROOT.test(url.pathname)) {
    return NextResponse.next();
  }

  if (host === APP_HOST) {
    url.pathname = `/app${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host === ADMIN_HOST) {
    url.pathname = `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host.endsWith(TENANT_SUFFIX)) {
    const slug = host.slice(0, -TENANT_SUFFIX.length);
    if (!slug || slug === "www") return NextResponse.next();
    url.pathname = `/tenant/${slug}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Custom domain (future): route to tenant domain lookup
  url.pathname = `/tenant_domain/${encodeURIComponent(host)}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
