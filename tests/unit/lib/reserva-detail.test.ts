import { describe, expect, it } from "vitest";
import {
  reservaSelectColumns,
  computeCobranza,
} from "@/lib/agency/reserva-detail";

// DETALLE-DE-RESERVA (s59) — costo de proveedor / neto / comisiones NO se traen al
// detalle para NINGUN rol (van a Finanzas, regla CEO). Data minimization: la columna
// que no se pide no entra al HTML/flight -> no se filtra. Este test fija el invariante.

describe("reservaSelectColumns — data minimization (sin margen ni comisiones)", () => {
  it("NO incluye costo de proveedor, neto ni FK de ruleset de comision", () => {
    const cols = reservaSelectColumns();
    expect(cols.includes("snapshot_provider_cost")).toBe(false);
    expect(cols.includes("snapshot_net")).toBe(false);
    expect(cols.includes("commission_ruleset_id")).toBe(false);
  });

  it("SI incluye el total (snapshot_gross) y datos no sensibles", () => {
    const cols = reservaSelectColumns();
    expect(cols.includes("snapshot_gross")).toBe(true);
    expect(cols.includes("reservation_code")).toBe(true);
    expect(cols.includes("holder_name")).toBe(true);
  });
});

describe("computeCobranza", () => {
  it("suma SOLO confirmados; saldo = gross - cobrado (data real 7G5XZZ)", () => {
    const r = computeCobranza("25000.00", [
      { status: "confirmado", amount: "100" },
      { status: "pendiente", amount: "5000" },
    ]);
    expect(r.cobrado).toBe(100);
    expect(r.saldo).toBe(24900);
  });

  it("sin pagos: cobrado 0, saldo = gross", () => {
    expect(computeCobranza("1000", [])).toEqual({ cobrado: 0, saldo: 1000 });
  });

  it("number|string y saldo negativo (snapshot de test, NO truncar a 0)", () => {
    expect(
      computeCobranza(100, [{ status: "confirmado", amount: 250 }]),
    ).toEqual({ cobrado: 250, saldo: -150 });
  });

  it("amount null o no-numerico cuenta como 0 (no NaN)", () => {
    const r = computeCobranza("500", [
      { status: "confirmado", amount: null },
      { status: "confirmado", amount: "200" },
    ]);
    expect(r.cobrado).toBe(200);
    expect(r.saldo).toBe(300);
  });
});
