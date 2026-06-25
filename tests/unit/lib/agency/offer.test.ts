import { describe, it, expect } from "vitest";
import { offerPct, offerShown, OFFER_THRESHOLD } from "@/lib/agency/offer";

// offerPct/offerShown REPLICAN la formula del template publico (Servicios.tsx
// offerPct + gate pct>=10). Estos tests fijan la equivalencia 1:1 para que un drift
// del panel vs el sitio se cace en CI. Valores = ofertas REALES vivas de PV.
describe("offer (replica template eventos offerPct + umbral 10%)", () => {
  it("calcula el % de descuento (ofertas reales PV)", () => {
    expect(offerPct(72000, 100000)).toBe(28); // Cerro Tronador / Circuito Grande
    expect(offerPct(25000, 50000)).toBe(50); // Circuito Chico (motor base 25000)
    expect(offerPct(72000, 93000)).toBe(23); // El Bolson (round half-up)
    expect(offerPct(83000, 95000)).toBe(13); // Villa Traful
    expect(offerPct(40000, 70000)).toBe(43); // Teleferico Cerro Otto
  });

  it("0% (sin oferta) si regular ausente, promo ausente, o regular <= promo", () => {
    expect(offerPct(72000, null)).toBe(0);
    expect(offerPct(72000, undefined)).toBe(0);
    expect(offerPct(null, 100000)).toBe(0);
    expect(offerPct(undefined, 100000)).toBe(0);
    expect(offerPct(80000, 80000)).toBe(0); // igual = sin oferta
    expect(offerPct(90000, 80000)).toBe(0); // regular < promo = sin oferta
  });

  it("offerShown gatea exacto en el umbral del 10% (espeja pct>=10 del render)", () => {
    expect(OFFER_THRESHOLD).toBe(10);
    expect(offerPct(90000, 100000)).toBe(10); // exactamente 10%
    expect(offerShown(90000, 100000)).toBe(true); // 10% -> se tacha
    expect(offerPct(91000, 100000)).toBe(9); // 9%
    expect(offerShown(91000, 100000)).toBe(false); // < 10% -> render limpio
    expect(offerShown(72000, 100000)).toBe(true); // 28% -> se tacha
    expect(offerShown(72000, null)).toBe(false); // sin regular -> no se tacha
  });
});
