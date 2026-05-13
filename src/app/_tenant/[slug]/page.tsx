import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getTemplate } from "@/templates/registry";

export const revalidate = 60;

/**
 * Pre-render all published tenant slugs at build time.
 * Fallback (revalidate=60) handles new tenants after deploy.
 */
export async function generateStaticParams() {
  const { getSupabaseServiceClient: getSvc } =
    await import("@/lib/supabase/service");
  const supabase = getSvc();
  const { data } = await supabase
    .from("tenants")
    .select("slug")
    .eq("status", "published");
  return (data ?? []).map((t: { slug: string }) => ({ slug: t.slug }));
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant || tenant.status !== "published") notFound();

  const supabase = getSupabaseServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("content_json,design_json,media_json,seo_json")
    .eq("tenant_id", tenant.id)
    .single();

  const template = getTemplate(tenant.template_key);
  if (!template || !site) notFound();

  const content = template.contentSchema.parse(site.content_json);
  const design = template.designSchema.parse(site.design_json);
  const media = template.mediaSchema.parse(site.media_json);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Site = template.Site as React.ComponentType<any>;
  return (
    <Site
      content={content}
      design={design}
      media={media}
      tenantId={tenant.id}
      tenantName={tenant.name}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return {};

  const supabase = getSupabaseServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("seo_json")
    .eq("tenant_id", tenant.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seo = (site?.seo_json ?? {}) as Record<string, any>;
  const description: string =
    seo.description ?? `Sitio oficial de ${tenant.name}`;

  return {
    title: tenant.name,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title: tenant.name,
      description,
      type: "website",
    },
  };
}
