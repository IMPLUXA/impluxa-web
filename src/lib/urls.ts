import "server-only";
import { headers } from "next/headers";
import { CUSTOM_DOMAIN_TENANTS } from "@/lib/tenants/custom-domain-map";

// B-Fase2 — helpers canónicos de URLs por-tenant (mata los hardcodes
// `.impluxa.com` dispersos, hallazgo Pass-2 B-Fase1). Server-only: el
// basePath se deriva del Host header, DISPLAY/NAV-ONLY — la autoridad de
// datos siempre es el claim JWT + RLS, nunca el host.

const TENANT_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? ".impluxa.com";
const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "app.impluxa.com";

// Mismo charset que impone el API de creación de tenants. Re-validar el slug
// con esto antes de construir URLs absolutas (C3 del review B-Fase2): un slug
// fuera de charset no puede denotar otro origin.
export const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/;

/** URL pública del sitio del tenant (https://slug.impluxa.com). */
export function siteUrl(slug: string): string {
  return `https://${slug}${TENANT_SUFFIX}`;
}

/** Host visible del sitio del tenant (slug.impluxa.com, sin scheme). */
export function siteHostLabel(slug: string): string {
  return `${slug}${TENANT_SUFFIX}`;
}

/**
 * basePath del back-office según el host del request:
 * - app.impluxa.com (árbol /app)      → ""        (hrefs /dashboard, como hoy)
 * - {slug}.impluxa.com (árbol admin)  → "/admin"  (hrefs EXTERNOS /admin/...;
 *   el middleware los rewritea a /tenant/{slug}/admin/... — NUNCA poner
 *   /tenant/{slug} en un href: double-prefix).
 */
export async function getAdminBasePath(): Promise<"" | "/admin"> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  // ADMIN-AR C2: el admin en dominio custom usa el MISMO basePath externo
  // /admin (el rewrite C1 del middleware lo aterriza en /tenant/{slug}/admin).
  // Gateado por el mismo flag que el rewrite — activación atómica. hasOwn:
  // espejo del fold C1 (Host tipo "__proto__" no hereda de Object.prototype).
  if (
    process.env["PV_AR_ADMIN"] === "on" &&
    Object.hasOwn(CUSTOM_DOMAIN_TENANTS, host)
  ) {
    return "/admin";
  }
  if (host !== APP_HOST && host.endsWith(TENANT_SUFFIX)) return "/admin";
  return "";
}

// Subdominios que jamás denotan un tenant aunque terminen en TENANT_SUFFIX
// (hosts de plataforma + www). Evita una query a DB por slugs imposibles.
export const RESERVED_TENANT_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "auth",
]);

/**
 * Deriva el slug de tenant de un VALOR de Host header. Función pura (testeable
 * sin mocks); parity exacta con middleware.ts:53+81-83: lowercase + sufijo,
 * SIN strip de puerto (un host con puerto no matchea el sufijo → null →
 * superficie genérica, mismo resultado que el middleware que tampoco lo
 * strippea). Charset re-validado con TENANT_SLUG_RE (C3 B-Fase2). DISPLAY/
 * BRANDING-ONLY: la autoridad de datos sigue siendo claim JWT + RLS.
 */
export function tenantSlugFromHostValue(rawHost: string | null): string | null {
  const host = (rawHost ?? "").toLowerCase();
  // ADMIN-AR C2: dominio custom mapeado → slug del tenant (login branded +
  // postLoginPath), gateado por el MISMO flag que el rewrite C1 — atómico.
  // Sin strip de puerto: un host con puerto no matchea la key → null, mismo
  // modo de falla que el sufijo. El slug sale del literal del mapa (jamás
  // del request); DISPLAY/BRANDING-ONLY, la autoridad sigue en claim + RLS.
  if (
    process.env["PV_AR_ADMIN"] === "on" &&
    Object.hasOwn(CUSTOM_DOMAIN_TENANTS, host)
  ) {
    return CUSTOM_DOMAIN_TENANTS[host];
  }
  if (!host || host === APP_HOST || !host.endsWith(TENANT_SUFFIX)) return null;
  const slug = host.slice(0, -TENANT_SUFFIX.length);
  if (!slug || RESERVED_TENANT_SUBDOMAINS.has(slug)) return null;
  if (!TENANT_SLUG_RE.test(slug)) return null;
  return slug;
}

/**
 * Slug de tenant del request actual (o null en hosts de plataforma).
 * `headers().get("host")` es el header correcto en este stack: getAdminBasePath
 * lo usa igual y está validado LIVE en prod (B-Fase2).
 */
export async function tenantSlugFromHost(): Promise<string | null> {
  return tenantSlugFromHostValue((await headers()).get("host"));
}
