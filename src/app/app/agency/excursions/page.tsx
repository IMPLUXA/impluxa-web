import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExcursionsManager } from "./ExcursionsManager";
import type { ExcursionRow, ProviderRow } from "@/lib/agency/schemas";

// Área interna (back-office). NO toca el template público Hakuna.
export const dynamic = "force-dynamic";

export default async function ExcursionsPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  // Membership-aware (fix s46): ver layout.tsx. null = drift → fail-closed. Multi-tenant safe.
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "agency_excursions_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  // Cliente AUTENTICADO (no service_role): la RLS F1 enforce el rol y el
  // aislamiento por tenant. service_role daría falso-verde (lesson s45).
  const sb = await getSupabaseServerClient();
  const [{ data: excursions }, { data: providers }] = await Promise.all([
    sb
      .from("excursions")
      .select(
        "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
      )
      .eq("tenant_id", tenant.id) // redundante a RLS, consistencia con handlers
      .order("created_at", { ascending: false }),
    // Todos los providers (incl. archivados) para el name-map; el dropdown filtra activos.
    sb
      .from("providers")
      .select("id,tenant_id,name,contact_json,payout_terms,active,created_at")
      .eq("tenant_id", tenant.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <ExcursionsManager
      initialExcursions={(excursions ?? []) as ExcursionRow[]}
      providers={(providers ?? []) as ProviderRow[]}
    />
  );
}
