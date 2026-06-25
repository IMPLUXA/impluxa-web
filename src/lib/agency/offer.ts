// offerPct — REPLICA EXACTA de la formula del template publico
// (src/templates/eventos/components/Servicios.tsx offerPct + el gate `pct >= 10`
// del render). Se duplica A PROPOSITO en vez de importar del template: ese modulo
// es el template COMPARTIDO Hakuna+turismo y tocarlo dispararia el gate
// byte-identico + ASK CEO. La formula es 1 linea y estable; si el template cambia
// el calculo o el umbral, reflejarlo aca.
// ponytail: duplicacion deliberada para no tocar el template compartido (byte-id Hakuna).

export const OFFER_THRESHOLD = 10;

/**
 * % de descuento mostrado (precio de lista tachado vs promo cobrado). 0 si no hay
 * oferta valida (regular null/undefined, promo null/undefined, o regular <= promo).
 * Espeja Servicios.tsx::offerPct 1:1.
 */
export function offerPct(
  promo: number | null | undefined,
  regular: number | null | undefined,
): number {
  if (regular == null || promo == null || regular <= promo) return 0;
  return Math.round((1 - promo / regular) * 100);
}
