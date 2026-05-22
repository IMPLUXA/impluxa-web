import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { ContentEditor } from "./ContentEditor";

export default async function ContentPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getCurrentTenant(user.id);
  // W1.T2 nit-MED fix: see layout.tsx for rationale. Drift = burn-gate
  // corruption invisible. Defense-in-depth redirect fail-closed.
  if (!tenant) redirect("/login?error=no_tenant");
  if (tenant.id !== tenantId) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "content_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
        membership_tenant_id: tenant.id,
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
