import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyRole } from "@/lib/agency/role";
import { redirect } from "next/navigation";
import { DeparturesManager } from "./DeparturesManager";
import type { DepartureRow, ExcursionRow } from "@/lib/agency/schemas";

// R1 salidas/cupo — área interna (back-office). NO toca el template público.
export const dynamic = "force-dynamic";

export default async function DeparturesPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  // Membership-aware (fix s46): null = drift → fail-closed.
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "agency_departures_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  // canEdit espeja la RLS (write = encargado + dueno_admin) para la capa UI.
  // Fail-closed: rol null → solo lectura. La autoridad sigue siendo la RLS.
  const role = await getAgencyRole();
  const canEdit = role === "encargado" || role === "dueno_admin";

  // Cliente AUTENTICADO (no service_role): RLS enforce rol y tenant (lesson s45).
  const sb = await getSupabaseServerClient();
  const [{ data: departures }, { data: excursions }] = await Promise.all([
    sb
      .from("excursion_departures")
      .select(
        "id,tenant_id,excursion_id,departure_date,departure_time,capacity,status,created_at",
      )
      .eq("tenant_id", tenant.id) // redundante a RLS, consistencia con handlers
      .order("departure_date", { ascending: true })
      .order("departure_time", { ascending: true, nullsFirst: true }),
    // Todas (incl. inactivas) para el name-map; el selector de alta filtra activas.
    sb
      .from("excursions")
      .select(
        "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
      )
      .eq("tenant_id", tenant.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <DeparturesManager
      initialDepartures={(departures ?? []) as DepartureRow[]}
      excursions={(excursions ?? []) as ExcursionRow[]}
      canEdit={canEdit}
    />
  );
}
