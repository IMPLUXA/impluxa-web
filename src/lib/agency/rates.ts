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
 * numeric llega como string; la cuenta se hace en centavos enteros para no
 * meter float en plata. factor NULL (categoría sin definir) → null.
 * Redondeo: half-up al centavo (display; el reparto real es F9, otro gate).
 */
export function priceForFactor(
  basePrice: string,
  priceFactor: string | null,
): string | null {
  if (priceFactor === null) return null;
  // Number("") === 0 (no NaN): string vacío/whitespace debe dar null, no "0.00".
  if (basePrice.trim() === "" || priceFactor.trim() === "") return null;
  const cents = Math.round(Number(basePrice) * 100);
  const factorBp = Math.round(Number(priceFactor) * 10000);
  if (!Number.isFinite(cents) || !Number.isFinite(factorBp)) return null;
  const resultCents = Math.round((cents * factorBp) / 10000);
  return (resultCents / 100).toFixed(2);
}
