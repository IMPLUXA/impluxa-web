import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// C12 (puente público, corte 1) — capa de lectura PÚBLICA del motor de
// tarifas F3b para el render ISR del sitio del tenant. El sitio público
// sigue siendo content_json-first: este módulo solo PISA el precio de un
// servicio o paseo con la tarifa VIGENTE del motor cuando hay match inequívoco.
//
// REGLAS FAIL-CLOSED (todas degradan al valor de content_json, nunca rompen):
//  - La lib NUNCA lanza: cualquier error/timeout → Map vacío → content puro.
//  - Map vacío → applyCurrentRates devuelve EL MISMO objeto (no-op por
//    identidad). Hakuna tiene 0 excursions → este es su camino SIEMPRE →
//    byte-identidad por construcción (patrón emit-when-present).
//  - Solo moneda ARS: el template formatea ARS hardcodeado; un rate en otra
//    moneda se DESCARTA (catch Pass-2: número USD mostrado como ARS sería
//    bug silencioso con build verde).
//  - base_price no-finito o <= 0 → descartado (PostgREST entrega numeric
//    como NÚMERO o string según el camino — bug P0 s49: boundary tolera
//    ambos vía String()).
//  - JOIN-BY-NAME (BRIDGE-KEY-1): el match es excursions.name ===
//    servicios[].title (6/6 medido s51) Y paseos[].title (12/12 seed M2 s53).
//    Names DUPLICADOS en el tenant → ese name se descarta entero (nunca
//    elección no-determinística).
//  - Solo se PISA un precio que el content YA muestra (price_ars presente):
//    jamás se agrega precio a un item sin precio — la FORMA del render
//    no cambia, solo el número.

const FETCH_TIMEOUT_MS = 3_000;

type ExcEmbed = { name: string; active: boolean };

// PostgREST entrega el embed to-one como OBJETO en runtime, pero supabase-js
// sin tipos generados lo infiere como ARRAY (lesson tipos-boundary s49: el
// boundary tolera AMBAS formas en vez de castear a ciegas).
type RateJoinRow = {
  base_price: number | string;
  currency: string;
  excursions: ExcEmbed | ExcEmbed[] | null;
};

function embedOf(row: RateJoinRow): ExcEmbed | null {
  const e = row.excursions;
  if (!e) return null;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

// Item del content con title + precio opcional. El puente usa la misma forma
// para ambos arrays: servicios[] (full) y paseos[] (light, "Otras excursiones").
type PricedItem = { title: string; price_ars?: number };

function logEvent(event: string, fields: Record<string, unknown>): void {
  console.error(
    JSON.stringify({ level: "warn", scope: "public_rates", event, ...fields }),
  );
}

/**
 * Normaliza base_price (number | string) a entero ARS positivo, o null.
 * Math.round: el display público usa maximumFractionDigits 0 — normalizamos
 * en el boundary, no delegamos al formatter.
 */
function normalizePrice(raw: number | string): number | null {
  const str = String(raw);
  if (str.trim() === "") return null;
  const n = Math.round(Number(str));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Construye el Map name → precio vigente a partir de las filas crudas.
 * Pura (testeable sin red). Aplica TODAS las reglas fail-closed de arriba.
 */
export function buildRatesMap(rows: RateJoinRow[]): Map<string, number> {
  const map = new Map<string, number>();
  const dupes = new Set<string>();
  for (const row of rows) {
    const exc = embedOf(row);
    const name = exc?.name;
    if (!name || exc?.active !== true) continue;
    if (row.currency !== "ARS") {
      logEvent("public_rates_non_ars_discarded", {
        name,
        currency: row.currency,
      });
      continue;
    }
    const price = normalizePrice(row.base_price);
    if (price === null) {
      logEvent("public_rates_invalid_price_discarded", { name });
      continue;
    }
    if (dupes.has(name)) continue;
    if (map.has(name)) {
      // Name duplicado en el tenant: ninguna de las tarifas pisa el content.
      map.delete(name);
      dupes.add(name);
      logEvent("public_rates_duplicate_name_discarded", { name });
      continue;
    }
    map.set(name, price);
  }
  return map;
}

/**
 * Tarifas vigentes (valid_to IS NULL) de las excursiones ACTIVAS del tenant,
 * como Map name → precio entero ARS. Service client (página pública ISR, sin
 * sesión). NUNCA lanza: error, shape inesperado o timeout → Map vacío.
 */
export async function getPublicCurrentRates(
  tenantId: string,
): Promise<Map<string, number>> {
  try {
    const sb = getSupabaseServiceClient();
    const query = sb
      .from("excursion_rates")
      .select("base_price,currency,excursions!inner(name,active)")
      .eq("tenant_id", tenantId)
      .is("valid_to", null)
      .eq("excursions.active", true);

    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), FETCH_TIMEOUT_MS),
    );
    const result = await Promise.race([query, timeout]);

    if (result === "timeout") {
      logEvent("public_rates_fetch_timeout", { tenant_id: tenantId });
      return new Map();
    }
    if (result.error) {
      logEvent("public_rates_fetch_failed", {
        tenant_id: tenantId,
        code: result.error.code ?? null,
      });
      return new Map();
    }
    return buildRatesMap((result.data ?? []) as RateJoinRow[]);
  } catch (err) {
    logEvent("public_rates_fetch_threw", {
      tenant_id: tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }
}

/**
 * Aplica el precio vigente a un array de items (servicios o paseos) que el
 * content YA muestra con precio. Marca en `matched` todo título con tarifa
 * correspondiente (haya o no price_ars) para el diagnóstico de unmatched.
 * NUNCA agrega precio donde el content no lo muestra (la forma del render no
 * cambia, solo el número). price_regular_ars jamás se toca.
 */
function applyToItems(
  items: PricedItem[] | undefined,
  rates: Map<string, number>,
  matched: Set<string>,
): void {
  if (!items) return;
  for (const it of items) {
    const price = rates.get(it.title);
    if (price == null) continue;
    matched.add(it.title);
    if (it.price_ars == null) {
      // El content no muestra precio para este item: no agregamos uno
      // (la forma del render no cambia por el puente, solo el número).
      continue;
    }
    it.price_ars = price;
  }
}

/**
 * Pisa price_ars de cada servicio Y paseo cuyo title matchea una tarifa
 * vigente (join-by-name BRIDGE-KEY-1). Map vacío → devuelve EL MISMO objeto
 * sin tocar nada (no-op por identidad: el camino de Hakuna y de cualquier
 * tenant sin motor → byte-identidad por construcción). Muta in-place el clon
 * que devuelve zod.parse (verificado Pass-1: parse devuelve objeto plano
 * nuevo, no frozen). price_regular_ars NUNCA se toca: si el vigente supera al
 * regular, la oferta tachada desaparece sola (offerPct → 0), comportamiento
 * legal-safe ya existente en el template.
 */
export function applyCurrentRates<
  T extends { servicios?: PricedItem[]; paseos?: PricedItem[] },
>(content: T, rates: Map<string, number>): T {
  if (rates.size === 0) return content;
  const { servicios, paseos } = content;
  const hasServicios = !!servicios && servicios.length > 0;
  const hasPaseos = !!paseos && paseos.length > 0;
  if (!hasServicios && !hasPaseos) return content;

  const matched = new Set<string>();
  applyToItems(servicios, rates, matched);
  applyToItems(paseos, rates, matched);

  const unmatched: string[] = [];
  for (const name of rates.keys()) {
    if (!matched.has(name)) unmatched.push(name);
  }
  if (unmatched.length > 0) {
    // Tarifa del motor sin servicio NI paseo correspondiente en content_json:
    // señal de rename/drift del join-by-name (BRIDGE-KEY-1).
    logEvent("public_rates_unmatched", { names: unmatched });
  }
  return content;
}
