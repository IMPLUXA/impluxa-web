import { describe, expect, it } from "vitest";
import { priceForFactor } from "@/lib/agency/rates";

// F3b C3 — priceForFactor es la única aritmética de plata del módulo de
// lectura (display dashboard). Centavos enteros, nunca float directo.
// Los factores reales seedeados: adulto 1.0 / niño 0.5 / infante 0.0 / 3ra 0.9.

describe("priceForFactor", () => {
  it("adulto 100%: precio igual", () => {
    expect(priceForFactor("38000.00", "1.0000")).toBe("38000.00");
  });

  it("niño 50%: mitad exacta", () => {
    expect(priceForFactor("38000.00", "0.5000")).toBe("19000.00");
  });

  it("infante 0%: gratis", () => {
    expect(priceForFactor("80000.00", "0.0000")).toBe("0.00");
  });

  it("3ra edad 90% del caso real Catedral", () => {
    expect(priceForFactor("38000.00", "0.9000")).toBe("34200.00");
  });

  it("factor NULL (sin definir) → null, no inventa precio", () => {
    expect(priceForFactor("38000.00", null)).toBeNull();
  });

  it("centavos: no acumula error float (10.10 * 0.3333)", () => {
    // 1010 cents * 3333bp / 10000 = 336.633 → 337 cents half-up
    expect(priceForFactor("10.10", "0.3333")).toBe("3.37");
  });

  it("inputs no numéricos → null, no NaN en pantalla", () => {
    expect(priceForFactor("abc", "0.5")).toBeNull();
    expect(priceForFactor("100", "xyz")).toBeNull();
  });

  it("string vacío/whitespace → null (Number('')===0, no debe dar 0.00)", () => {
    expect(priceForFactor("", "0.5")).toBeNull();
    expect(priceForFactor("100", "  ")).toBeNull();
  });

  it("NÚMEROS JSON de PostgREST (bug P0 s49: numeric llega number, no string)", () => {
    expect(priceForFactor(38000, 0.9)).toBe("34200.00");
    expect(priceForFactor(38000, "0.5000")).toBe("19000.00");
    expect(priceForFactor("38000.00", 1)).toBe("38000.00");
    expect(priceForFactor(80000, 0)).toBe("0.00");
    expect(priceForFactor(38000, null)).toBeNull();
  });

  it("boundary half-up exacto: 12.5 centavos → 0.13", () => {
    expect(priceForFactor("0.25", "0.5000")).toBe("0.13");
  });
});
