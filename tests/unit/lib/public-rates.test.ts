import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildRatesMap, applyCurrentRates } from "@/lib/public/rates";

// C12 puente público — las reglas fail-closed del helper SON el contrato:
// cada caso de abajo es una regla del plan (Two-Pass BA + cold s51). Si un
// PR cambia una regla, tiene que cambiar el test correspondiente A PROPÓSITO.

// Silenciar el log estructurado en tests (la lib loggea por console.error).
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const row = (
  name: string,
  base_price: number | string,
  currency = "ARS",
  active = true,
) => ({ base_price, currency, excursions: { name, active } });

describe("buildRatesMap (reglas fail-closed del boundary)", () => {
  it("filas válidas → map name→precio entero", () => {
    const map = buildRatesMap([
      row("Cerro Catedral", 38000),
      row("Circuito Chico", "36000.00"),
    ]);
    expect(map.get("Cerro Catedral")).toBe(38000);
    expect(map.get("Circuito Chico")).toBe(36000); // string numeric (P0 s49)
    expect(map.size).toBe(2);
  });

  it("redondea decimales en el boundary (no delega al formatter)", () => {
    const map = buildRatesMap([row("X", 38000.5)]);
    expect(map.get("X")).toBe(38001);
  });

  it("moneda != ARS se descarta (catch Pass-2: USD mostrado como ARS)", () => {
    const map = buildRatesMap([row("Dolarizada", 100, "USD")]);
    expect(map.size).toBe(0);
  });

  it("precio no-finito, vacío, cero o negativo se descarta", () => {
    const map = buildRatesMap([
      row("A", Number.NaN),
      row("B", ""),
      row("C", 0),
      row("D", -5),
      row("E", "no-numerico"),
    ]);
    expect(map.size).toBe(0);
  });

  it("name DUPLICADO en el tenant → ese name queda fuera entero (las 2+ filas)", () => {
    const map = buildRatesMap([
      row("Repetida", 10000),
      row("Repetida", 20000),
      row("Repetida", 30000),
      row("Sana", 5000),
    ]);
    expect(map.has("Repetida")).toBe(false);
    expect(map.get("Sana")).toBe(5000);
  });

  it("embed como ARRAY (forma que infiere supabase-js sin tipos generados) también se procesa", () => {
    const map = buildRatesMap([
      {
        base_price: 41000,
        currency: "ARS",
        excursions: [{ name: "Embed Array", active: true }],
      },
    ]);
    expect(map.get("Embed Array")).toBe(41000);
  });

  it("excursión inactive o embed nulo se ignoran", () => {
    const map = buildRatesMap([
      row("Inactiva", 10000, "ARS", false),
      { base_price: 9000, currency: "ARS", excursions: null },
    ]);
    expect(map.size).toBe(0);
  });
});

describe("applyCurrentRates (no-op por identidad + override mínimo)", () => {
  it("map VACÍO → devuelve EL MISMO objeto, sin mutar nada (camino Hakuna)", () => {
    const content = {
      servicios: [{ title: "Cerro Catedral", price_ars: 38000 }],
      otra_key: "intacta",
    };
    const before = JSON.stringify(content);
    const result = applyCurrentRates(content, new Map());
    expect(result).toBe(content); // identidad estricta, no clon
    expect(JSON.stringify(result)).toBe(before);
  });

  it("content sin servicios → mismo objeto aunque haya rates", () => {
    const content = {} as {
      servicios?: { title: string; price_ars?: number }[];
    };
    const result = applyCurrentRates(content, new Map([["X", 1000]]));
    expect(result).toBe(content);
  });

  it("match por title → pisa price_ars con la vigente del motor", () => {
    const content = {
      servicios: [
        { title: "Cerro Catedral", price_ars: 38000 },
        { title: "Cerro Tronador", price_ars: 72000 },
      ],
    };
    const rates = new Map([["Cerro Catedral", 42000]]);
    const result = applyCurrentRates(content, rates);
    expect(result.servicios![0]!.price_ars).toBe(42000); // pisado
    expect(result.servicios![1]!.price_ars).toBe(72000); // sin match: intacto
  });

  it("price_regular_ars JAMÁS se toca (la oferta se autoprotege en el template)", () => {
    const content = {
      servicios: [
        { title: "Cerro Catedral", price_ars: 38000, price_regular_ars: 50000 },
      ],
    };
    const result = applyCurrentRates(
      content,
      new Map([["Cerro Catedral", 55000]]),
    );
    expect(result.servicios![0]!.price_ars).toBe(55000);
    expect(result.servicios![0]!.price_regular_ars).toBe(50000);
  });

  it("servicio SIN price_ars en content → NO se agrega precio (la forma del render no cambia)", () => {
    const content = { servicios: [{ title: "Sin Precio" }] };
    const result = applyCurrentRates(content, new Map([["Sin Precio", 9000]]));
    expect(result.servicios![0]!.price_ars).toBeUndefined();
  });

  it("rate sin servicio correspondiente (rename/drift) → no rompe, loggea unmatched", () => {
    const content = {
      servicios: [{ title: "Cerro Catedral", price_ars: 38000 }],
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = applyCurrentRates(
      content,
      new Map([
        ["Cerro Catedral", 39000],
        ["Excursion Renombrada", 50000],
      ]),
    );
    expect(result.servicios![0]!.price_ars).toBe(39000);
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("public_rates_unmatched");
    expect(logged).toContain("Excursion Renombrada");
  });
});
