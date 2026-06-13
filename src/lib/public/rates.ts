import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// C12 (puente público, corte 1) — capa de lectura PÚBLICA del motor de
// tarifas F3b para el render ISR del sitio del tenant. El sitio público
// sigue siendo content_json-first: este módulo solo PISA el precio de un
// servicio o paseo con la tarifa VIGENTE del motor cuando hay match inequívoco.
//
// REGLAS FAIL-CLOSED (todas degradan al valor de content_json, nunca rompen):
//  - La lib NUNCA lanza: cualquier error/timeout → lookup vacío → content puro.
//  - Lookup vacío → applyCurrentRates devuelve EL MISMO objeto (no-op por
//    identidad). Hakuna tiene 0 excursions → este es su camino SIEMPRE →
//    byte-identidad por construcción (patrón emit-when-present).
//  - Solo moneda ARS: el template formatea ARS hardcodeado; un rate en otra
//    moneda se DESCARTA (catch Pass-2: número USD mostrado como ARS sería
//    bug silencioso con build verde).
//  - base_price no-finito o <= 0 → descartado (PostgREST entrega numeric
//    como NÚMERO o string según el camino — bug P0 s49: boundary tolera
//    ambos vía String()).
//  - JOIN id-preferido, fallback name (BRIDGE-KEY-1 closure M4 s53): el match
//    prefiere content_json.excursion_id === excursions.id (estable ante rename);
//    si el item no trae excursion_id (tenants/items sin persistir), cae al
//    match por title === excursions.name (comportamiento previo). El byId usa
//    la PK → NUNCA ambiguo; el byName descarta names DUPLICADOS del tenant
//    (un item sin id que apunte a un name duplicado no pisa: elección no
//    determinística evitada — pero un item CON excursion_id sí resuelve).
//  - Solo se PISA un precio que el content YA muestra (price_ars presente):
//    jamás se agrega precio a un item sin precio — la FORMA del render
//    no cambia, solo el número.

const FETCH_TIMEOUT_MS = 3_000;

type ExcEmbed = { id: string; name: string; active: boolean };

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

// Item del content con title + precio opcional + (M4) excursion_id opcional.
// El puente usa la misma forma para ambos arrays: servicios[] (full) y
// paseos[] (light, "Otras excursiones").
type PricedItem = { title: string; price_ars?: number; excursion_id?: string };

// Tabla de búsqueda de tarifas vigentes: por id (preferido, estable ante
// rename) y por name (fallback). `entries` lleva los pares (id,name) válidos
// para el diagnóstico de unmatched (drift del join).
export type RatesLookup = {
  byId: Map<string, number>;
  byName: Map<string, number>;
  entries: { id: string; name: string }[];
};

function emptyLookup(): RatesLookup {
  return { byId: new Map(), byName: new Map(), entries: [] };
}

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
 * Construye el RatesLookup (byId + byName + entries) a partir de las filas
 * crudas. Pura (testeable sin red). Aplica TODAS las reglas fail-closed.
 * byId: la PK es única → siempre indexable (cierra BRIDGE-KEY-1). byName:
 * names duplicados en el tenant se descartan (ambiguos por nombre).
 */
export function buildRatesMap(rows: RateJoinRow[]): RatesLookup {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  const entries: { id: string; name: string }[] = [];
  const dupes = new Set<string>();
  for (const row of rows) {
    const exc = embedOf(row);
    const id = exc?.id;
    const name = exc?.name;
    if (!id || !name || exc?.active !== true) continue;
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
    // id = PK única → siempre se indexa (resuelve incluso names duplicados).
    byId.set(id, price);
    entries.push({ id, name });
    // name puede duplicarse en el tenant → ambiguo por nombre → se descarta
    // del byName (un item con excursion_id igual resuelve vía byId).
    if (dupes.has(name)) continue;
    if (byName.has(name)) {
      byName.delete(name);
      dupes.add(name);
      logEvent("public_rates_duplicate_name_discarded", { name });
      continue;
    }
    byName.set(name, price);
  }
  return { byId, byName, entries };
}

/**
 * Tarifas vigentes (valid_to IS NULL) de las excursiones ACTIVAS del tenant,
 * como RatesLookup. Service client (página pública ISR, sin sesión). NUNCA
 * lanza: error, shape inesperado o timeout → lookup vacío.
 */
export async function getPublicCurrentRates(
  tenantId: string,
): Promise<RatesLookup> {
  try {
    const sb = getSupabaseServiceClient();
    const query = sb
      .from("excursion_rates")
      .select("base_price,currency,excursions!inner(id,name,active)")
      .eq("tenant_id", tenantId)
      .is("valid_to", null)
      .eq("excursions.active", true);

    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), FETCH_TIMEOUT_MS),
    );
    const result = await Promise.race([query, timeout]);

    if (result === "timeout") {
      logEvent("public_rates_fetch_timeout", { tenant_id: tenantId });
      return emptyLookup();
    }
    if (result.error) {
      logEvent("public_rates_fetch_failed", {
        tenant_id: tenantId,
        code: result.error.code ?? null,
      });
      return emptyLookup();
    }
    return buildRatesMap((result.data ?? []) as RateJoinRow[]);
  } catch (err) {
    logEvent("public_rates_fetch_threw", {
      tenant_id: tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
    return emptyLookup();
  }
}

/**
 * Resuelve el precio de un item: excursion_id (preferido) → byId, fallback
 * title → byName. Registra qué consumió (id o name) para el diagnóstico de
 * unmatched. NUNCA agrega precio donde el content no lo muestra. price_regular_ars
 * jamás se toca.
 */
function applyToItems(
  items: PricedItem[] | undefined,
  lookup: RatesLookup,
  consumedIds: Set<string>,
  consumedNames: Set<string>,
): void {
  if (!items) return;
  for (const it of items) {
    let price: number | undefined;
    if (it.excursion_id != null && lookup.byId.has(it.excursion_id)) {
      price = lookup.byId.get(it.excursion_id);
      consumedIds.add(it.excursion_id);
    } else {
      price = lookup.byName.get(it.title);
      if (price != null) consumedNames.add(it.title);
    }
    if (price == null) continue;
    if (it.price_ars == null) {
      // El content no muestra precio para este item: no agregamos uno
      // (la forma del render no cambia por el puente, solo el número).
      continue;
    }
    it.price_ars = price;
  }
}

/**
 * Pisa price_ars de cada servicio Y paseo cuya tarifa vigente resuelve por
 * excursion_id (preferido) o por title (fallback). Lookup vacío → devuelve EL
 * MISMO objeto sin tocar nada (no-op por identidad: el camino de Hakuna y de
 * cualquier tenant sin motor → byte-identidad por construcción). Muta in-place
 * el clon que devuelve zod.parse (verificado Pass-1: parse devuelve objeto
 * plano nuevo, no frozen). price_regular_ars NUNCA se toca: si el vigente supera
 * al regular, la oferta tachada desaparece sola (offerPct → 0), comportamiento
 * legal-safe ya existente en el template.
 */
export function applyCurrentRates<
  T extends { servicios?: PricedItem[]; paseos?: PricedItem[] },
>(content: T, lookup: RatesLookup): T {
  if (lookup.byId.size === 0 && lookup.byName.size === 0) return content;
  const { servicios, paseos } = content;
  const hasServicios = !!servicios && servicios.length > 0;
  const hasPaseos = !!paseos && paseos.length > 0;
  if (!hasServicios && !hasPaseos) return content;

  const consumedIds = new Set<string>();
  const consumedNames = new Set<string>();
  applyToItems(servicios, lookup, consumedIds, consumedNames);
  applyToItems(paseos, lookup, consumedIds, consumedNames);

  // Tarifa del motor que ningún servicio/paseo consumió (ni por id ni por name):
  // señal de rename/drift del join (BRIDGE-KEY-1).
  const unmatched = [
    ...new Set(
      lookup.entries
        .filter((e) => !consumedIds.has(e.id) && !consumedNames.has(e.name))
        .map((e) => e.name),
    ),
  ];
  if (unmatched.length > 0) {
    logEvent("public_rates_unmatched", { names: unmatched });
  }
  return content;
}
