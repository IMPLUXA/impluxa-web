import { NextRequest, NextResponse } from "next/server";
import createNextIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

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

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();

  // Marketing site: delegate to next-intl (handles /es /en locale routing)
  if (MARKETING_HOSTS.has(host)) {
    return intlMiddleware(req);
  }

  const url = req.nextUrl.clone();

  if (host === APP_HOST) {
    url.pathname = `/_app${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host === ADMIN_HOST) {
    url.pathname = `/_admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (host.endsWith(TENANT_SUFFIX)) {
    const slug = host.slice(0, -TENANT_SUFFIX.length);
    if (!slug || slug === "www") return NextResponse.next();
    url.pathname = `/_tenant/${slug}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Custom domain (future): route to tenant domain lookup
  url.pathname = `/_tenant_domain/${encodeURIComponent(host)}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
