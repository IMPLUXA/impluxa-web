import { NextRequest, NextResponse } from "next/server";
import createNextIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getMonitoringLimiter } from "./lib/ratelimit";
import { CUSTOM_DOMAIN_TENANTS } from "./lib/tenants/custom-domain-map";

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
    // RENAME turismo -> patagoniaviva: 301 the OLD subdomain to the new one.
    // ENV-GATED OFF by default: ships inert in Stage 1 so turismo keeps serving
    // (additive principle). Activated atomically with the DB slug flip in Stage 3
    // by setting PV_RENAME_REDIRECT=on (+ redeploy). Preserves path + query.
    if (slug === "turismo" && process.env["PV_RENAME_REDIRECT"] === "on") {
      const dest = req.nextUrl.clone();
      dest.host = `patagoniaviva${TENANT_SUFFIX}`;
      return NextResponse.redirect(dest, 301);
    }
    // DOMINIO-PV-1 fase B: 301 the public tree of the old subdomain to the
    // custom domain. ENV-GATED OFF by default: ships inert, activated in the
    // P7 cutover step by setting PV_AR_REDIRECT=on (+ redeploy). Preserves
    // path + query. /admin is EXEMPT — the tenant admin stays on
    // .impluxa.com (the .ar tree has no admin route, 404 by construction).
    // /login, /api, /robots.txt, /sitemap.xml never reach this branch
    // (SHARED_ROOT returns earlier).
    if (
      slug === "patagoniaviva" &&
      process.env["PV_AR_REDIRECT"] === "on" &&
      url.pathname !== "/admin" &&
      !url.pathname.startsWith("/admin/")
    ) {
      const dest = req.nextUrl.clone();
      dest.host = "patagoniaviva.ar";
      dest.port = "";
      return NextResponse.redirect(dest, 301);
    }
    // ADMIN-AR-MIGRATION corte 6: la PUERTA VIEJA del admin 301ea a la nueva
    // en .ar. Es el COMPLEMENTO por path de la exención de arriba: dispara
    // SOLO para /admin|/admin/* (mutuamente excluyente con el redirect público
    // P7 → cero doble-redirect). ENV-GATED OFF: ship inerte, activado por
    // PV_AR_ADMIN_REDIRECT=on + redeploy DESPUÉS de walk CEO verde + dueño
    // avisado (doble gate humano). Preserva path+query. /login del host viejo
    // NO se toca (SHARED_ROOT retorna antes); el 301 de /admin funela igual al
    // dueño a .ar (301 → .ar/admin → e07 → .ar/login).
    if (
      slug === "patagoniaviva" &&
      process.env["PV_AR_ADMIN_REDIRECT"] === "on" &&
      (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
    ) {
      const dest = req.nextUrl.clone();
      dest.host = "patagoniaviva.ar";
      dest.port = "";
      return NextResponse.redirect(dest, 301);
    }
    url.pathname = `/tenant/${slug}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // ADMIN-AR-MIGRATION C1: tenant admin on its custom domain. ENV-GATED OFF
  // by default — ships inert, activated in C3 via PV_AR_ADMIN=on + redeploy.
  // The rewrite lands on /tenant/<slug>/admin/** so the e07->e08->e09 guard
  // chain runs byte-identical to the old host (slug comes from the literal
  // map, authority stays claim JWT + RLS). Path guard mirrors the /admin
  // exemption above. Custom domains NOT in the map fall through to the
  // public lookup below (their /admin 404s structurally, unchanged).
  // Object.hasOwn: a Host like "__proto__"/"constructor" must not resolve
  // members inherited from Object.prototype (fold dual CR+SE cold C1).
  const mappedSlug = Object.hasOwn(CUSTOM_DOMAIN_TENANTS, host)
    ? CUSTOM_DOMAIN_TENANTS[host]
    : undefined;
  if (
    mappedSlug &&
    process.env["PV_AR_ADMIN"] === "on" &&
    (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
  ) {
    url.pathname = `/tenant/${mappedSlug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Custom domain: route to tenant domain lookup (app/tenant_domain/[domain]).
  // Root guard mirrors the tenant branch above — no trailing slash on "/".
  url.pathname = `/tenant_domain/${encodeURIComponent(host)}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
