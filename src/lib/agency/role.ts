import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// F-UI-BRANDED corte 3 — matriz de roles (autorización de NAVEGACIÓN).
//
// La AUTORIDAD DE DATOS sigue siendo la RLS (#22/#23: policies RESTRICTIVE
// por tenant + dueno_admin para writes). Esto NO la reemplaza: gatea qué
// items del nav se muestran (UI) y qué páginas dueño-only son alcanzables
// (guard server-side). Un no-dueño que igual fuerza un write lo come la RLS.
//
// Fuente del rol: RPC `current_agency_role()` (v030_001) vía cliente
// AUTENTICADO — lee el rol del caller en su tenant ACTIVO (claim JWT
// active_tenant_id, mismo origen que current_active_tenant() de la RLS).
// FAIL-CLOSED: cualquier error/null → null → tratado como NO-dueño (panel
// mínimo, guard rebota). Nunca un throw fuera del helper.

export type AgencyRole = "dueno_admin" | "encargado" | "vendedor" | null;

const OWNER_ROLE = "dueno_admin";

/**
 * Rol del caller en su tenant activo, o null (sin rol / error → fail-closed).
 * React.cache: dedup per-request — el layout lo lee para filtrar el Sidebar
 * Y la page dueño-only lo lee para el guard, en el mismo request.
 */
export const getAgencyRole = cache(
  async function getAgencyRole(): Promise<AgencyRole> {
    try {
      const sb = await getSupabaseServerClient();
      const { data, error } = await sb.rpc("current_agency_role");
      if (error) {
        // Fail-closed PERO no mudo (Pass-2 SE): un dueño con el RPC roto
        // rebota igual que un probe — este log es lo que los distingue en
        // forensics (mismo criterio que tenant_claim_membership_drift).
        console.error(
          JSON.stringify({
            level: "error",
            event: "agency_role_rpc_failed",
            code: error.code ?? null,
          }),
        );
        return null;
      }
      if (data === OWNER_ROLE || data === "encargado" || data === "vendedor") {
        return data;
      }
      return null;
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "agency_role_rpc_threw",
          err: err instanceof Error ? err.message : String(err),
        }),
      );
      return null;
    }
  },
);

/** true SOLO si el caller es dueño del tenant activo. */
export function isAgencyOwner(role: AgencyRole): boolean {
  return role === OWNER_ROLE;
}

/**
 * Guard de página dueño-only. Rebota a un destino opaco (NO leak del
 * diferenciador) si el caller no es dueño. DEBE invocarse en la PAGE BASE
 * (src/app/app/<ruta>/page.tsx), no solo en el wrapper tenant: app.impluxa.com
 * rewritea a /app/* y la base es alcanzable sin pasar por el wrapper
 * (catch Pass-2 SE del plan). Fail-closed por construcción (getAgencyRole
 * devuelve null ante cualquier duda → rebota).
 *
 * Catálogo de códigos opacos: e07 claim / e08 drift / e09 host-vs-claim →
 * destino /login (el caller NO tiene sesión-tenant usable). e10 no-dueño →
 * destino "/" DELIBERADO (el caller SÍ está autenticado con tenant válido,
 * solo le falta jerarquía; mandarlo a /login sería mentirle el problema y
 * en branded "/" es el sitio público del tenant, sin loop).
 */
export async function requireAgencyOwner(): Promise<void> {
  const role = await getAgencyRole();
  if (!isAgencyOwner(role)) {
    redirect("/?e=e10");
  }
}
