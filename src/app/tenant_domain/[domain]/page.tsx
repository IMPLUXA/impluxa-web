import { notFound } from "next/navigation";
import { resolveTenantByDomain } from "@/lib/tenants/resolve";
import TenantPage, {
  generateMetadata as slugGenerateMetadata,
} from "@/app/tenant/[slug]/page";

export const revalidate = 60;

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
