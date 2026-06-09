import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { ContentEditor } from "./ContentEditor";

export default async function ContentPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  // Membership-aware (fix s46): ver layout.tsx. Resuelve el tenant activo del
  // claim confirmando membership real; null = drift → fail-closed. Multi-tenant safe.
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "content_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }
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
