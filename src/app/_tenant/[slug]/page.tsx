import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getTemplate } from "@/templates/registry";

export const revalidate = 60;

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
}) {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return {};
  return { title: tenant.name };
}
