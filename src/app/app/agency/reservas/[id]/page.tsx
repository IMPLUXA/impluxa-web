import { notFound, redirect } from "next/navigation";
import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyRole } from "@/lib/agency/role";
import { getAdminBasePath } from "@/lib/urls";
import {
  canSeeMargin,
  reservaSelectColumns,
  type ReservaDetailRow,
  type PaxRow,
  type PagoRow,
  type DepartureInfo,
  type MarginInfo,
  type SplitRow,
  type RulesetInfo,
} from "@/lib/agency/reserva-detail";
import { ReservaDetail } from "./ReservaDetail";

// DETALLE-DE-RESERVA (s59) — vista read-only de UNA reserva. NO toca el template publico.
// Cliente AUTENTICADO: la RLS aisla (reservas_role_select/pagos_role_select/... tenant +
// row-scoped; vendedor solo lo suyo -> fila ajena = 0 filas = notFound). El bloque MARGEN
// (costo/neto/comision-dueno) se gatea a encargado/dueno Y sus columnas NI se seleccionan
// para el vendedor (no entran al payload RSC). Pagina + componente = server puro.
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

  const role = await getAgencyRole();
  const seeMargin = canSeeMargin(role);
  const sb = await getSupabaseServerClient();
  const adminBase = await getAdminBasePath();

  // Reserva — columnas de margen SOLO si seeMargin (no-leak RSC). RLS scope: tenant +
  // (vendedor solo si seller propio). .eq tenant redundante a RLS, consistencia handlers.
  const { data: reservaData, error } = await sb
    .from("reservas")
    .select(reservaSelectColumns(seeMargin))
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

  // Margen: splits + ruleset SOLO si seeMargin (si no, ni se consultan -> no-leak RSC).
  let margin: MarginInfo | null = null;
  if (seeMargin) {
    const [splitsRes, rulesetRes] = await Promise.all([
      sb
        .from("commission_splits")
        .select("role_at_sale,pct_applied,amount,agency_staff(display_name)")
        .eq("reserva_id", id),
      reserva.commission_ruleset_id
        ? sb
            .from("commission_rulesets")
            .select(
              "net_commission_pct,split_vendedor_pct,split_dueno_pct,split_encargado_pct,is_provisional",
            )
            .eq("id", reserva.commission_ruleset_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    margin = {
      splits: (splitsRes.data ?? []) as unknown as SplitRow[],
      ruleset: (rulesetRes.data ?? null) as unknown as RulesetInfo | null,
    };
  }

  const sellerName =
    (sellerRes.data as { display_name?: string } | null)?.display_name ?? null;

  return (
    <ReservaDetail
      reserva={reserva}
      pasajeros={(paxRes.data ?? []) as unknown as PaxRow[]}
      pagos={(pagosRes.data ?? []) as unknown as PagoRow[]}
      departure={(depRes.data ?? null) as unknown as DepartureInfo | null}
      sellerName={sellerName}
      seeMargin={seeMargin}
      margin={margin}
      backHref={`${adminBase}/agency/reservas`}
    />
  );
}
