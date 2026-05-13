import { requireUser } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { ContentEditor } from "./ContentEditor";

export default async function ContentPage() {
  const user = await requireUser();
  const tenant = (await getCurrentTenant(user.id))!;
  const sb = getSupabaseServiceClient();
  const { data: site } = await sb
    .from("sites")
    .select("content_json,published_at")
    .eq("tenant_id", tenant.id)
    .single();
  return (
    <ContentEditor
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      initialContent={site?.content_json ?? {}}
      publishedAt={site?.published_at ?? null}
    />
  );
}
