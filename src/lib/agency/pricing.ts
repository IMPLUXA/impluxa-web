// Pricing del alta agency — REPLICA EXACTA del calculo de agency_crear_reserva
// (migration v030_012 L254-276): 3 redondeos half-up, sin redondeo final, en
// CENTAVOS. El total mostrado en el wizard tiene que dar el MISMO gross_cents
// que crea el server (mismo input -> mismo numero, sin drift de 1 peso).
//
// SQL replicado:
//   base_cents := round(base_price * 100)
//   factor_bp  := round(factor * 10000)
//   unit_cents := round(base_cents * factor_bp / 10000)   -- half-up
//   gross      := sum(unit_cents * qty)                   -- SIN round final
//
// PG round() = half-away-from-zero; para valores positivos = half-up. Lo
// replicamos con aritmetica entera (floor((n + 5000) / 10000)) para evitar
// drift de float en el borde .5. El monto autoritativo lo manda el server
// (gross_cents); esto es SOLO display.

export type PaxLine = { factor: number; qty: number };

export function unitCents(basePriceArs: number, factor: number): number {
  const baseCents = Math.round(basePriceArs * 100);
  const factorBp = Math.round(factor * 10000);
  return Math.floor((baseCents * factorBp + 5000) / 10000); // half-up entero
}

export function grossCents(basePriceArs: number, lines: PaxLine[]): number {
  return lines.reduce(
    (sum, l) => sum + unitCents(basePriceArs, l.factor) * l.qty,
    0,
  );
}

// El server guarda snapshot_gross = gross_cents / 100; el envelope devuelve
// gross_cents (centavos). Para mostrar en ARS.
export function centsToArs(cents: number): number {
  return cents / 100;
}
