import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyRole } from "@/lib/agency/role";
import { getAdminBasePath } from "@/lib/urls";
import { redirect } from "next/navigation";
import { ReservasManager } from "./ReservasManager";
import type {
  DepartureRow,
  ExcursionRow,
  PassengerCategoryRow,
  ReservaRow,
} from "@/lib/agency/schemas";

// R3 reservas — área interna (back-office). NO toca el template público.
// La LISTA viene con el cliente AUTENTICADO: la RLS aplica tal cual la
// matriz de roles (vendedor ve SOLO sus reservas — policy por seller;
// encargado/dueño ven todas las del tenant). Declarado en la UI.
export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "agency_reservas_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  const role = await getAgencyRole();
  // Crear reserva = los 3 roles (la RPC #24 es la autoridad; null = fail-closed).
  const canCreate =
    role === "vendedor" || role === "encargado" || role === "dueno_admin";
  // C7.2: cobrar/confirmar = SOLO encargado/dueño (vendedor NO, discovery s52).
  // Misma fuente que el role-gate del route (current_agency_role) → sin drift.
  const canCharge = role === "encargado" || role === "dueno_admin";

  const sb = await getSupabaseServerClient();
  // adminBase host-aware (server-only) -> prop al client (la fila arma el href del detalle).
  const adminBase = await getAdminBasePath();
  const [
    { data: reservas },
    { data: departures },
    { data: excursions },
    { data: categories },
    { data: paymentMethods },
  ] = await Promise.all([
    sb
      .from("reservas")
      .select(
        // Margen (snapshot_provider_cost/net) NO se trae al listado: nadie lo
        // renderiza y arrastrarlo al flight = leak RSC (Security cold s59). Costos
        // y comisiones van a finanzas, no a las vistas de reserva. El detalle lo
        // trae gateado por rol. Data minimization: lo que no se trae no se filtra.
        "id,tenant_id,departure_id,seller_staff_id,holder_name,holder_email,holder_phone,holder_lodging,status,reservation_code,snapshot_currency,snapshot_gross,hold_expires_at,created_at",
      )
      .eq("tenant_id", tenant.id) // redundante a RLS, consistencia handlers
      .order("created_at", { ascending: false }),
    sb
      .from("excursion_departures")
      .select(
        "id,tenant_id,excursion_id,departure_date,departure_time,capacity,status,created_at",
      )
      .eq("tenant_id", tenant.id)
      .order("departure_date", { ascending: true }),
    sb
      .from("excursions")
      .select(
        "id,tenant_id,provider_id,name,description,category,active,default_currency,created_at",
      )
      .eq("tenant_id", tenant.id)
      .order("name", { ascending: true }),
    sb
      .from("passenger_categories")
      .select("id,tenant_id,code,label,price_factor,created_at")
      .eq("tenant_id", tenant.id)
      .order("price_factor", { ascending: false, nullsFirst: false }),
    sb
      .from("payment_methods")
      .select("code,label,active")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("code", { ascending: true }),
  ]);

  return (
    <ReservasManager
      adminBase={adminBase}
      initialReservas={(reservas ?? []) as ReservaRow[]}
      departures={(departures ?? []) as DepartureRow[]}
      excursions={(excursions ?? []) as ExcursionRow[]}
      categories={(categories ?? []) as PassengerCategoryRow[]}
      canCreate={canCreate}
      canCharge={canCharge}
      paymentMethods={(paymentMethods ?? []).map((m) => ({
        code: m.code as string,
        label: m.label as string,
      }))}
      isVendedor={role === "vendedor"}
    />
  );
}
