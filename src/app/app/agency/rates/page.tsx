import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RatesManager } from "./RatesManager";
import { getCurrentRates, getPassengerCategories } from "@/lib/agency/rates";
import type { ExcursionRow } from "@/lib/agency/schemas";

// F3b CRUD UI tarifas — área interna (back-office). NO toca template público.
export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  // Membership-aware (fix s46): null = drift → fail-closed.
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "agency_rates_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  // Cliente AUTENTICADO (no service_role): RLS del caller es la autoridad.
  const sb = await getSupabaseServerClient();
  const [{ data: excursions }, { data: rates }, { data: categories }, role] =
    await Promise.all([
      sb
        .from("excursions")
        .select(
          "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
        )
        .eq("tenant_id", tenant.id)
        .eq("active", true)
        .order("name", { ascending: true }),
      getCurrentRates(sb, tenant.id),
      getPassengerCategories(sb, tenant.id),
      // Rol del caller para gatear la UI de edición (la RLS sigue siendo la
      // autoridad real; esto solo decide qué controles se renderizan).
      sb.rpc("current_agency_role").then(({ data }) => data as string | null),
    ]);

  return (
    <RatesManager
      excursions={(excursions ?? []) as ExcursionRow[]}
      initialRates={rates ?? []}
      initialCategories={categories ?? []}
      role={role}
      canEdit={role === "dueno_admin"}
    />
  );
}
