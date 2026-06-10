import "server-only";
import { headers } from "next/headers";

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
  if (host !== APP_HOST && host.endsWith(TENANT_SUFFIX)) return "/admin";
  return "";
}
