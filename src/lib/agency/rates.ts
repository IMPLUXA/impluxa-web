import type { SupabaseClient } from "@supabase/supabase-js";
import type { PassengerCategoryRow, RateRow } from "@/lib/agency/schemas";

// F3b C3 — lectura del motor de tarifas versionadas. SOLO área interna
// (dashboard): el sitio público sigue leyendo content_json hasta C12-C14.
// Siempre cliente AUTENTICADO (RLS aplica al caller); el eq(tenant_id) es
// defensa en profundidad redundante, patrón F3a.

const RATE_COLUMNS =
  "id,tenant_id,excursion_id,base_price,provider_cost,currency,valid_from,valid_to,created_by,created_at";

const CATEGORY_COLUMNS = "id,tenant_id,code,label,price_factor,created_at";

/** Tarifas VIGENTES (valid_to IS NULL) de todas las excursiones del tenant. */
export async function getCurrentRates(sb: SupabaseClient, tenantId: string) {
  return sb
    .from("excursion_rates")
    .select(RATE_COLUMNS)
    .eq("tenant_id", tenantId)
    .is("valid_to", null)
    .order("valid_from", { ascending: false })
    .overrideTypes<RateRow[]>();
}

/** Historial completo de tarifas de UNA excursión, más nueva primero. */
export async function getRateHistory(
  sb: SupabaseClient,
  tenantId: string,
  excursionId: string,
) {
  return sb
    .from("excursion_rates")
    .select(RATE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("excursion_id", excursionId)
    .order("valid_from", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<RateRow[]>();
}

/** Categorías de pasajero del tenant (adulto/niño/infante/3ra-edad). */
export async function getPassengerCategories(
  sb: SupabaseClient,
  tenantId: string,
) {
  return sb
    .from("passenger_categories")
    .select(CATEGORY_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("price_factor", { ascending: false, nullsFirst: false })
    .overrideTypes<PassengerCategoryRow[]>();
}

/**
 * Precio por categoría de pasajero, para DISPLAY del dashboard.
 * BUG P0 s49: PostgREST entrega `numeric` como NÚMERO JSON (verificado en
 * runtime: `.trim is not a function` en prod) — el boundary acepta
 * number | string y normaliza con String(). La cuenta va en centavos
 * enteros (nunca float de plata). factor NULL → null.
 * Redondeo: half-up al centavo (display; el reparto real es F9, otro gate).
 */
export function priceForFactor(
  basePrice: number | string,
  priceFactor: number | string | null,
): string | null {
  if (priceFactor === null) return null;
  const baseStr = String(basePrice);
  const factorStr = String(priceFactor);
  // Number("") === 0 (no NaN): string vacío/whitespace debe dar null, no "0.00".
  if (baseStr.trim() === "" || factorStr.trim() === "") return null;
  const cents = Math.round(Number(baseStr) * 100);
  const factorBp = Math.round(Number(factorStr) * 10000);
  if (!Number.isFinite(cents) || !Number.isFinite(factorBp)) return null;
  const resultCents = Math.round((cents * factorBp) / 10000);
  return (resultCents / 100).toFixed(2);
}

/**
 * Precios de lista (price_regular_ars) por excursion_id, leidos de content_json
 * (tabla sites). El "tachado" de la oferta vive en el content, NO en el motor de
 * tarifas; este reader lo trae para el DISPLAY del panel Tarifas (tachado + -X%)
 * y el pre-fill del modal. Cliente AUTENTICADO (RLS member-select del caller; el
 * dueno es member). Devuelve solo items con regular numerico positivo. NUNCA lanza:
 * sin sitio / shape inesperado -> objeto vacio.
 * Boundary (lesson tipos-boundary s49): price_regular_ars puede llegar number o
 * string segun el camino -> Number() y se descarta lo no-finito.
 */
export async function getRegularPricesByExcursion(
  sb: SupabaseClient,
  tenantId: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const { data } = await sb
    .from("sites")
    .select("content_json")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const content = (data?.content_json ?? null) as {
    servicios?: {
      excursion_id?: string;
      price_regular_ars?: number | string;
    }[];
    paseos?: { excursion_id?: string; price_regular_ars?: number | string }[];
  } | null;
  if (!content) return out;
  for (const arr of [content.servicios, content.paseos]) {
    if (!Array.isArray(arr)) continue;
    for (const it of arr) {
      const id = it?.excursion_id;
      if (typeof id !== "string" || id === "") continue;
      if (it?.price_regular_ars == null) continue;
      const reg = Number(it.price_regular_ars);
      if (Number.isFinite(reg) && reg > 0) out[id] = reg;
    }
  }
  return out;
}
