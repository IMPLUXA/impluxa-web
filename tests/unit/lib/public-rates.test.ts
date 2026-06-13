import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildRatesMap, applyCurrentRates } from "@/lib/public/rates";

// C12 puente público — las reglas fail-closed del helper SON el contrato:
// cada caso de abajo es una regla del plan (Two-Pass BA + cold s51/s53). Si un
// PR cambia una regla, tiene que cambiar el test correspondiente A PROPÓSITO.
// M4 (s53): el lookup ahora es {byId, byName, entries}; el join prefiere
// excursion_id (estable ante rename) con fallback a name (BRIDGE-KEY-1 closure).

// Silenciar el log estructurado en tests (la lib loggea por console.error).
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const row = (
  name: string,
  base_price: number | string,
  opts: { id?: string; currency?: string; active?: boolean } = {},
) => ({
  base_price,
  currency: opts.currency ?? "ARS",
  excursions: {
    id: opts.id ?? "id-" + name,
    name,
    active: opts.active ?? true,
  },
});

describe("buildRatesMap (reglas fail-closed del boundary)", () => {
  it("filas válidas → byName + byId con el precio entero", () => {
    const lk = buildRatesMap([
      row("Cerro Catedral", 38000, { id: "cat" }),
      row("Circuito Chico", "36000.00", { id: "chi" }),
    ]);
    expect(lk.byName.get("Cerro Catedral")).toBe(38000);
    expect(lk.byId.get("cat")).toBe(38000);
    expect(lk.byName.get("Circuito Chico")).toBe(36000); // string numeric (P0 s49)
    expect(lk.byId.get("chi")).toBe(36000);
    expect(lk.byName.size).toBe(2);
    expect(lk.byId.size).toBe(2);
  });

  it("redondea decimales en el boundary (no delega al formatter)", () => {
    const lk = buildRatesMap([row("X", 38000.5)]);
    expect(lk.byName.get("X")).toBe(38001);
  });

  it("moneda != ARS se descarta (catch Pass-2: USD mostrado como ARS)", () => {
    const lk = buildRatesMap([row("Dolarizada", 100, { currency: "USD" })]);
    expect(lk.byName.size).toBe(0);
    expect(lk.byId.size).toBe(0);
  });

  it("precio no-finito, vacío, cero o negativo se descarta", () => {
    const lk = buildRatesMap([
      row("A", Number.NaN),
      row("B", ""),
      row("C", 0),
      row("D", -5),
      row("E", "no-numerico"),
    ]);
    expect(lk.byName.size).toBe(0);
    expect(lk.byId.size).toBe(0);
  });

  it("name DUPLICADO → fuera del byName, PERO el byId conserva cada id (M4: el id resuelve)", () => {
    const lk = buildRatesMap([
      row("Repetida", 10000, { id: "rep-a" }),
      row("Repetida", 20000, { id: "rep-b" }),
      row("Sana", 5000, { id: "sana" }),
    ]);
    expect(lk.byName.has("Repetida")).toBe(false); // ambiguo por nombre
    expect(lk.byId.get("rep-a")).toBe(10000); // id sigue resolviendo
    expect(lk.byId.get("rep-b")).toBe(20000);
    expect(lk.byName.get("Sana")).toBe(5000);
  });

  it("embed como ARRAY (forma que infiere supabase-js sin tipos generados) también se procesa", () => {
    const lk = buildRatesMap([
      {
        base_price: 41000,
        currency: "ARS",
        excursions: [{ id: "ea", name: "Embed Array", active: true }],
      },
    ]);
    expect(lk.byName.get("Embed Array")).toBe(41000);
    expect(lk.byId.get("ea")).toBe(41000);
  });

  it("excursión inactive o embed nulo se ignoran", () => {
    const lk = buildRatesMap([
      row("Inactiva", 10000, { active: false }),
      { base_price: 9000, currency: "ARS", excursions: null },
    ]);
    expect(lk.byName.size).toBe(0);
    expect(lk.byId.size).toBe(0);
  });
});

describe("applyCurrentRates (no-op por identidad + override mínimo)", () => {
  it("lookup VACÍO → devuelve EL MISMO objeto, sin mutar nada (camino Hakuna)", () => {
    const content = {
      servicios: [{ title: "Cerro Catedral", price_ars: 38000 }],
      otra_key: "intacta",
    };
    const before = JSON.stringify(content);
    const result = applyCurrentRates(content, buildRatesMap([]));
    expect(result).toBe(content); // identidad estricta, no clon
    expect(JSON.stringify(result)).toBe(before);
  });

  it("content sin servicios ni paseos → mismo objeto aunque haya rates", () => {
    const content = {} as {
      servicios?: { title: string; price_ars?: number }[];
    };
    const result = applyCurrentRates(content, buildRatesMap([row("X", 1000)]));
    expect(result).toBe(content);
  });

  it("fallback por title (item sin excursion_id) → pisa price_ars con la vigente", () => {
    const content = {
      servicios: [
        { title: "Cerro Catedral", price_ars: 38000 },
        { title: "Cerro Tronador", price_ars: 72000 },
      ],
    };
    const lk = buildRatesMap([row("Cerro Catedral", 42000)]);
    const result = applyCurrentRates(content, lk);
    expect(result.servicios![0]!.price_ars).toBe(42000); // pisado por name
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
      buildRatesMap([row("Cerro Catedral", 55000)]),
    );
    expect(result.servicios![0]!.price_ars).toBe(55000);
    expect(result.servicios![0]!.price_regular_ars).toBe(50000);
  });

  it("item SIN price_ars en content → NO se agrega precio (la forma del render no cambia)", () => {
    const content: { servicios: { title: string; price_ars?: number }[] } = {
      servicios: [{ title: "Sin Precio" }],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Sin Precio", 9000)]),
    );
    expect(result.servicios![0]!.price_ars).toBeUndefined();
  });

  it("rate sin servicio correspondiente (rename/drift) → no rompe, loggea unmatched", () => {
    const content = {
      servicios: [{ title: "Cerro Catedral", price_ars: 38000 }],
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    spy.mockClear();
    const result = applyCurrentRates(
      content,
      buildRatesMap([
        row("Cerro Catedral", 39000),
        row("Excursion Renombrada", 50000),
      ]),
    );
    expect(result.servicios![0]!.price_ars).toBe(39000);
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("public_rates_unmatched");
    expect(logged).toContain("Excursion Renombrada");
  });
});

describe("applyCurrentRates — paseos[] (M3: puente extendido a las 'Otras')", () => {
  it("fallback por title en un paseo → pisa price_ars con la vigente", () => {
    const content = {
      paseos: [
        { title: "Villa Traful", price_ars: 82000 },
        { title: "Canopy", price_ars: 115000 },
      ],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Villa Traful", 90000)]),
    );
    expect(result.paseos![0]!.price_ars).toBe(90000); // pisado
    expect(result.paseos![1]!.price_ars).toBe(115000); // sin match: intacto
  });

  it("price_regular_ars de un paseo JAMÁS se toca (tachada legal-safe)", () => {
    const content = {
      paseos: [
        {
          title: "Teleférico Cerro Otto",
          price_ars: 40000,
          price_regular_ars: 70000,
        },
      ],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Teleférico Cerro Otto", 45000)]),
    );
    expect(result.paseos![0]!.price_ars).toBe(45000);
    expect(result.paseos![0]!.price_regular_ars).toBe(70000);
  });

  it("paseo SIN price_ars → NO se agrega precio (la forma del render no cambia)", () => {
    const content: { paseos: { title: string; price_ars?: number }[] } = {
      paseos: [{ title: "Sin Precio" }],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Sin Precio", 9000)]),
    );
    expect(result.paseos![0]!.price_ars).toBeUndefined();
  });

  it("pisa servicios Y paseos en la misma pasada", () => {
    const content = {
      servicios: [{ title: "Cerro Catedral", price_ars: 38000 }],
      paseos: [{ title: "Kayak en Lago Gutiérrez", price_ars: 72000 }],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([
        row("Cerro Catedral", 40000),
        row("Kayak en Lago Gutiérrez", 80000),
      ]),
    );
    expect(result.servicios![0]!.price_ars).toBe(40000);
    expect(result.paseos![0]!.price_ars).toBe(80000);
  });

  it("una tarifa que matchea un PASEO no se loggea como unmatched", () => {
    const content = {
      servicios: [{ title: "Cerro Catedral", price_ars: 38000 }],
      paseos: [{ title: "Villa Traful", price_ars: 82000 }],
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    spy.mockClear();
    applyCurrentRates(
      content,
      buildRatesMap([
        row("Cerro Catedral", 39000),
        row("Villa Traful", 90000), // matchea un paseo, NO un servicio
      ]),
    );
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).not.toContain("public_rates_unmatched");
  });

  it("paseo con tachada: el rate vigente JAMÁS toca price_regular_ars (autoprotege)", () => {
    const content = {
      paseos: [
        { title: "Villa Traful", price_ars: 82000, price_regular_ars: 95000 },
      ],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Villa Traful", 99000)]), // rate > price_regular_ars
    );
    expect(result.paseos![0]!.price_ars).toBe(99000);
    expect(result.paseos![0]!.price_regular_ars).toBe(95000); // intacto
  });

  it("sin servicios NI paseos → mismo objeto aunque haya rates (no-op)", () => {
    const content = {} as {
      servicios?: { title: string; price_ars?: number }[];
      paseos?: { title: string; price_ars?: number }[];
    };
    const result = applyCurrentRates(content, buildRatesMap([row("X", 1000)]));
    expect(result).toBe(content);
  });
});

describe("applyCurrentRates — join id-preferred (M4: BRIDGE-KEY-1 closure)", () => {
  it("item con excursion_id → resuelve por id (preferido sobre el name)", () => {
    const content = {
      paseos: [{ title: "Villa Traful", price_ars: 82000, excursion_id: "vt" }],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Villa Traful", 90000, { id: "vt" })]),
    );
    expect(result.paseos![0]!.price_ars).toBe(90000);
  });

  it("excursion_id GANA sobre title cuando apuntan a tarifas distintas", () => {
    // item.excursion_id -> tarifa A (id 'a', 100000); item.title coincide con
    // el name de la tarifa B ('b', 200000). Debe usar A (id-preferred).
    const content = {
      paseos: [{ title: "Nombre B", price_ars: 1, excursion_id: "a" }],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([
        row("Nombre A", 100000, { id: "a" }),
        row("Nombre B", 200000, { id: "b" }),
      ]),
    );
    expect(result.paseos![0]!.price_ars).toBe(100000); // por id 'a', no por title 'Nombre B'
  });

  it("excursion_id resuelve aunque el name esté DUPLICADO (el byName lo descartó)", () => {
    const content = {
      paseos: [{ title: "Repetida", price_ars: 1, excursion_id: "rep-b" }],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([
        row("Repetida", 10000, { id: "rep-a" }),
        row("Repetida", 20000, { id: "rep-b" }),
      ]),
    );
    expect(result.paseos![0]!.price_ars).toBe(20000); // id rep-b, sin ambigüedad
  });

  it("excursion_id que NO existe en el motor → cae al fallback por title", () => {
    const content = {
      paseos: [
        { title: "Villa Traful", price_ars: 82000, excursion_id: "fantasma" },
      ],
    };
    const result = applyCurrentRates(
      content,
      buildRatesMap([row("Villa Traful", 90000, { id: "vt" })]),
    );
    expect(result.paseos![0]!.price_ars).toBe(90000); // fallback name
  });

  it("rate consumido por id NO se loggea como unmatched", () => {
    const content = {
      paseos: [{ title: "Villa Traful", price_ars: 82000, excursion_id: "vt" }],
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    spy.mockClear();
    applyCurrentRates(
      content,
      buildRatesMap([row("Villa Traful", 90000, { id: "vt" })]),
    );
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).not.toContain("public_rates_unmatched");
  });
});
