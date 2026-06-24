import { describe, it, expect } from "vitest";
import { unitCents, grossCents } from "@/lib/agency/pricing";

// Verifica que el calc client == el del server (agency_crear_reserva v030_012).
// Valores esperados derivados de la formula SQL (round half-up por paso).
describe("agency pricing (replica server v030_012)", () => {
  it("factor 1.0 = precio entero a centavos (precios reales PV)", () => {
    expect(unitCents(25000, 1.0)).toBe(2_500_000); // Circuito Chico
    expect(unitCents(72000, 1.0)).toBe(7_200_000); // Cerro Tronador
    expect(unitCents(45000, 1.0)).toBe(4_500_000); // Cerro Catedral
  });

  it("factor 0.0 (infante) = 0", () => {
    expect(unitCents(25000, 0.0)).toBe(0);
  });

  it("factor fraccional half-up (robustez futura)", () => {
    // base 19.99 -> base_cents 1999; 1999*5000/10000 = 999.5 -> half-up 1000
    expect(unitCents(19.99, 0.5)).toBe(1000);
    // base 25001 -> 2500100*5000/10000 = 1250050.0 -> 1250050
    expect(unitCents(25001, 0.5)).toBe(1_250_050);
  });

  it("gross suma exacta sin round final (factores reales PV)", () => {
    // 2 adultos(1.0) + 1 nino(1.0) + 1 infante(0.0) @ 45000 = 3 * 4.500.000
    expect(
      grossCents(45000, [
        { factor: 1.0, qty: 2 },
        { factor: 1.0, qty: 1 },
        { factor: 0.0, qty: 1 },
      ]),
    ).toBe(13_500_000);
  });
});
