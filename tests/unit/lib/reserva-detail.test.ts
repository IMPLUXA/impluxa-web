import { describe, expect, it } from "vitest";
import {
  canSeeMargin,
  reservaSelectColumns,
  computeCobranza,
  RESERVA_MARGIN_COLUMNS,
} from "@/lib/agency/reserva-detail";

// DETALLE-DE-RESERVA (s59) — el gate de margen tiene DOS capas: render condicional
// (visual) + seleccion condicional de columnas (no-leak RSC). Este test cubre la 2da:
// si canSeeMargin=false, las columnas de costo/neto NI se piden -> no llegan al payload.

describe("canSeeMargin", () => {
  it("encargado/dueno ven margen; vendedor/null NO", () => {
    expect(canSeeMargin("dueno_admin")).toBe(true);
    expect(canSeeMargin("encargado")).toBe(true);
    expect(canSeeMargin("vendedor")).toBe(false);
    expect(canSeeMargin(null)).toBe(false);
  });
});

describe("reservaSelectColumns — gate de no-leak RSC", () => {
  it("vendedor (false): NO incluye ninguna columna de margen", () => {
    const cols = reservaSelectColumns(false);
    for (const c of RESERVA_MARGIN_COLUMNS) {
      expect(cols.includes(c)).toBe(false);
    }
    // pero SI el total (snapshot_gross), que el listado ya muestra a todos
    expect(cols.includes("snapshot_gross")).toBe(true);
  });

  it("encargado/dueno (true): incluye todas las columnas de margen", () => {
    const cols = reservaSelectColumns(true);
    for (const c of RESERVA_MARGIN_COLUMNS) {
      expect(cols.includes(c)).toBe(true);
    }
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
