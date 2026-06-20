import { notFound, redirect } from "next/navigation";
import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminBasePath } from "@/lib/urls";
import {
  reservaSelectColumns,
  type ReservaDetailRow,
  type PaxRow,
  type PagoRow,
  type DepartureInfo,
} from "@/lib/agency/reserva-detail";
import { ReservaDetail } from "./ReservaDetail";

// DETALLE-DE-RESERVA (s59) — vista read-only de UNA reserva. NO toca el template publico.
// Cliente AUTENTICADO: la RLS aisla (reservas_role_select/pagos_role_select/... tenant +
// row-scoped; vendedor solo lo suyo -> fila ajena = 0 filas = notFound). Costo/neto/
// comisiones NO se traen (van a Finanzas, regla CEO s59; ver reserva-detail.ts).
// Pagina + componente = server puro.
export const dynamic = "force-dynamic";

export default async function ReservaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "agency_reserva_detail_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  const sb = await getSupabaseServerClient();
  const adminBase = await getAdminBasePath();

  // Reserva. RLS scope: tenant + (vendedor solo si seller propio). .eq tenant
  // redundante a RLS, consistencia handlers. Sin columnas de margen (data min).
  const { data: reservaData, error } = await sb
    .from("reservas")
    .select(reservaSelectColumns())
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "agency_reserva_detail_read",
        code: error.code ?? null,
      }),
    );
    notFound();
  }
  if (!reservaData) notFound(); // inexistente o fuera de RLS (cross-tenant/cross-vendedor)
  const reserva = reservaData as unknown as ReservaDetailRow;

  const [paxRes, pagosRes, depRes, sellerRes] = await Promise.all([
    sb
      .from("reserva_pasajeros")
      .select("full_name,qty,unit_price,passenger_categories(code,label)")
      .eq("reserva_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("pagos")
      .select(
        "id,method_code,amount,status,mp_payment_id,confirmed_at,created_at",
      )
      .eq("reserva_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("excursion_departures")
      .select(
        "departure_date,departure_time,capacity,status,excursions(name,category)",
      )
      .eq("id", reserva.departure_id)
      .maybeSingle(),
    reserva.seller_staff_id
      ? sb
          .from("agency_staff")
          .select("display_name")
          .eq("id", reserva.seller_staff_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const sellerName =
    (sellerRes.data as { display_name?: string } | null)?.display_name ?? null;

  return (
    <ReservaDetail
      reserva={reserva}
      pasajeros={(paxRes.data ?? []) as unknown as PaxRow[]}
      pagos={(pagosRes.data ?? []) as unknown as PagoRow[]}
      departure={(depRes.data ?? null) as unknown as DepartureInfo | null}
      sellerName={sellerName}
      backHref={`${adminBase}/agency/reservas`}
    />
  );
}
