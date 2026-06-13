import { notFound } from "next/navigation";
import { resolveTenantByDomain } from "@/lib/tenants/resolve";
import TenantPage, {
  generateMetadata as slugGenerateMetadata,
} from "@/app/tenant/[slug]/page";

export const revalidate = 60;

/**
 * Pre-render published custom domains at build time so the custom-domain route
 * is ● SSG (cacheable at the edge → x-vercel-cache HIT) instead of ƒ Dynamic
 * (MISS per request). Without this the route renders on-demand every request
 * (~850ms-3.6s vs ~120ms del slug que SÍ tiene generateStaticParams). R-PUB B.1.
 *
 * El param es encodeURIComponent(host) (igual que produce el rewrite del
 * middleware). Replica el patrón de tenant/[slug] (DB published) — NO usa el
 * CUSTOM_DOMAIN_TENANTS admin-map (contrato SE: ese map es admin-only). try/catch
 * para que el build pase sin DB (CI): fallback [] → la ruta sigue siendo SSG-capable
 * y los domains se rinden on-demand vía ISR (con dynamicParams default true).
 */
export async function generateStaticParams() {
  try {
    const { getSupabaseServiceClient: getSvc } =
      await import("@/lib/supabase/service");
    const supabase = getSvc();
    const { data, error } = await supabase
      .from("tenants")
      .select("custom_domain")
      .eq("status", "published")
      .not("custom_domain", "is", null);
    if (error) return [];
    return (data ?? [])
      .map((t: { custom_domain: string | null }) => t.custom_domain)
      .filter((d): d is string => typeof d === "string" && d.length > 0)
      .map((d) => ({ domain: encodeURIComponent(d.toLowerCase()) }));
  } catch {
    // No DB creds at build time (CI): defer a runtime ISR.
    return [];
  }
}

// DNS hostname charset only (the param arrives encodeURIComponent-ed and
// lowercased by the middleware rewrite). Anything else is notFound() before
// touching the DB.
const HOST_RE = /^[a-z0-9.-]{1,253}$/;

/**
 * Custom-domain entry point (DOMINIO-PV-1 fase B). The middleware rewrites
 * any host that is not marketing/app/admin/*.impluxa.com to
 * /tenant_domain/<host>. This wrapper resolves the host against
 * `tenants.custom_domain` (exact match, fail-closed on missing/unpublished)
 * and delegates 100% of the render and metadata to the existing
 * /tenant/[slug] page — one source of truth, zero changes to shared files.
 *
 * Deliberately NO catch-all segment: deep paths like /admin on a custom
 * domain hit a route that does not exist and 404 structurally. The tenant
 * admin lives on *.impluxa.com only.
 */
async function toSlugParams(
  params: Promise<{ domain: string }>,
): Promise<{ slug: string }> {
  const { domain } = await params;
  let host: string;
  try {
    host = decodeURIComponent(domain).toLowerCase();
  } catch {
    notFound();
  }
  if (!HOST_RE.test(host)) notFound();
  const tenant = await resolveTenantByDomain(host);
  if (!tenant || tenant.status !== "published") notFound();
  return { slug: tenant.slug };
}

export default async function TenantDomainPage(props: {
  params: Promise<{ domain: string }>;
}) {
  return TenantPage({ params: toSlugParams(props.params) });
}

export async function generateMetadata(props: {
  params: Promise<{ domain: string }>;
}) {
  return slugGenerateMetadata({ params: toSlugParams(props.params) });
}
