import { Suspense } from "react";
import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { requireAgencyOwner } from "@/lib/agency/role";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MpConnectManager, type MpConnState } from "./MpConnectManager";

// UI-connect MP (s57) — Cobros: DUEÑO-ONLY (matriz de roles v2.1, igual que Finanzas).
// El guard vive en la PAGE BASE (no solo en el wrapper tenant): app.impluxa.com rewritea
// a /app/pagos y la base es alcanzable sin pasar por el wrapper. force-dynamic: lee el
// estado de conexión por-request (RPC mp_connection_status, NUNCA el token).
export const dynamic = "force-dynamic";

export default async function PagosPage() {
  // e07 → e08 (tenant activo + membership real, fail-closed)…
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "pagos_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }
  // …y e10: SOLO dueño (rebota opaco si no). Conectar la cuenta de cobro es acción de
  // dueño; la RLS sigue siendo la autoridad de datos.
  await requireAgencyOwner();

  // Estado de conexión (RPC v030_006 en prod). NUNCA toca el token (lo garantiza el RPC).
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("mp_connection_status");
  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_connection_status_failed",
        code: error.code ?? null,
      }),
    );
  }
  const env = (data ?? null) as {
    ok?: boolean;
    connected?: boolean;
    status?: string | null;
    connected_at?: string | null;
    mp_user_id?: string | null;
  } | null;
  // Two-Pass cold P4: distinguir "no conectado" de "no pudimos leer el estado".
  const loadError = !!error || !env?.ok;
  const state: MpConnState = {
    connected: !!env?.connected,
    status: env?.status ?? null,
    mpUserId: env?.mp_user_id ?? null,
    connectedAt: env?.connected_at ?? null,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1
          className="text-[26px] font-bold"
          style={{
            fontFamily: "var(--admin-heading-font, inherit)",
            color: "var(--admin-heading-color, inherit)",
          }}
        >
          Cobros
        </h1>
        <p className="text-ash mt-1 text-sm">
          Conectá tu cuenta de MercadoPago para cobrar las reservas con tarjeta.
          La plata de cada cobro va directo a tu cuenta.
        </p>
      </header>

      {/* Two-Pass cold P1: Suspense para useSearchParams (robusto aunque se quitara
          force-dynamic; hoy force-dynamic ya lo cubre). */}
      <Suspense fallback={null}>
        <MpConnectManager state={state} loadError={loadError} />
      </Suspense>
    </div>
  );
}
