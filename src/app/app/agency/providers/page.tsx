import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProvidersManager } from "./ProvidersManager";
import type { ProviderRow } from "@/lib/agency/schemas";

// Área interna (back-office). NO toca el template público Hakuna.
export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  // Membership-aware (fix s46): ver layout.tsx. null = drift → fail-closed. Multi-tenant safe.
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "agency_providers_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  // Cliente AUTENTICADO (no service_role): RLS F1 enforce rol + tenant.
  const sb = await getSupabaseServerClient();
  const { data: providers } = await sb
    .from("providers")
    .select("id,tenant_id,name,contact_json,payout_terms,active,created_at")
    .eq("tenant_id", tenant.id) // redundante a RLS, consistencia con excursions/handlers
    .order("name", { ascending: true });

  return (
    <ProvidersManager initialProviders={(providers ?? []) as ProviderRow[]} />
  );
}
