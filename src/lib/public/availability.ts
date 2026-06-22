import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// F2 — disponibilidad PUBLICA per-excursion para el render ISR del sitio del tenant.
// Espeja el patron de rates.ts: server-only, service-role, timeout-raced, FAIL-CLOSED.
//
// Seguridad (gate F2): el tenant se deriva del HOST server-side (el page lo pasa como
// tenantId), NUNCA del cliente. La RPC `_public_calendario_core` esta granteada SOLO a
// service_role (no anon, no authenticated) y aplica el allow-list EN SQL: devuelve solo
// {fecha, estado, quedan} y el numero exacto SOLO en escasez (resto: quedan=null). Esta
// lib no re-shapea: confia en el allow-list del SQL (defensa en profundidad), solo valida
// la forma del envelope y degrada a [] ante cualquier problema.
//
// SPARSE: la RPC trae solo los dias NO-default-disponibles (escasez/sin_disponibilidad).
// El front pinta los dias futuros NO listados como "disponible" (modelo abierto-por-defecto).
// Hakuna: 0 excursions -> el page no fetchea (sus servicios no traen excursion_id) -> este
// modulo nunca corre para Hakuna; aunque corriera, [] es inerte y la UI no cambia (stack).

const FETCH_TIMEOUT_MS = 3_000;

export type PublicDiaEstado =
  | "disponible"
  | "ultimos_lugares"
  | "sin_disponibilidad";

export type PublicDia = {
  fecha: string;
  estado: PublicDiaEstado;
  quedan: number | null;
};

function logEvent(event: string, fields: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      level: "warn",
      scope: "public_availability",
      event,
      ...fields,
    }),
  );
}

/**
 * Disponibilidad publica de UNA excursion en [from, to] (ISO date), como lista sparse
 * de dias no-default. NUNCA lanza: error, timeout o shape inesperado -> [].
 */
export async function getPublicAvailability(
  tenantId: string,
  excursionId: string,
  from: string,
  to: string,
): Promise<PublicDia[]> {
  try {
    const sb = getSupabaseServiceClient();
    const query = sb.rpc("_public_calendario_core", {
      p_tenant: tenantId,
      p_excursion_id: excursionId,
      p_from: from,
      p_to: to,
    });

    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), FETCH_TIMEOUT_MS),
    );
    const result = await Promise.race([query, timeout]);

    if (result === "timeout") {
      logEvent("public_avail_timeout", { excursion_id: excursionId });
      return [];
    }
    if (result.error) {
      logEvent("public_avail_failed", { code: result.error.code ?? null });
      return [];
    }
    const env = result.data as { ok?: boolean; dias?: PublicDia[] } | null;
    if (!env?.ok || !Array.isArray(env.dias)) return [];
    return env.dias;
  } catch (err) {
    logEvent("public_avail_threw", {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// F3 — categorias de pasajero del tenant (code/label/factor) para el desglose + total EN VIVO del
// modal de reserva. Dato PUBLICO-safe (labels + factores; los precios ya se muestran en las cards).
// El total client-side es solo DISPLAY: el RPC `public_crear_reserva` recalcula el precio server-side
// de forma autoritativa (el cliente nunca manda monto). Lectura via SERVICE-ROLE (no afectada por el
// revoke de grants anon C-3). FAIL-CLOSED: cualquier problema -> [] (el modal degrada el total a "—").
export type PublicCategoria = { code: string; label: string; factor: number };

export async function getPublicReservaCategorias(
  tenantId: string,
): Promise<PublicCategoria[]> {
  try {
    const sb = getSupabaseServiceClient();
    const query = sb
      .from("passenger_categories")
      .select("code,label,price_factor")
      .eq("tenant_id", tenantId)
      .order("price_factor", { ascending: false })
      .order("code", { ascending: true });

    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), FETCH_TIMEOUT_MS),
    );
    const result = await Promise.race([query, timeout]);
    if (result === "timeout") {
      logEvent("public_cat_timeout", { tenant_id: tenantId });
      return [];
    }
    if (result.error || !Array.isArray(result.data)) {
      logEvent("public_cat_failed", { code: result.error?.code ?? null });
      return [];
    }
    return result.data
      .filter(
        (
          r,
        ): r is {
          code: string;
          label: string;
          price_factor: number | string;
        } => typeof r.code === "string" && typeof r.label === "string",
      )
      .map((r) => ({
        code: r.code,
        label: r.label,
        factor: Number(r.price_factor),
      }))
      .filter((c) => Number.isFinite(c.factor));
  } catch (err) {
    logEvent("public_cat_threw", {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
