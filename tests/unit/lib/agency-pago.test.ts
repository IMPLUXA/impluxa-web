import { describe, expect, it } from "vitest";
import {
  PagoConfirmarSchema,
  buildAgencyConfirmarReservaArgs,
} from "@/lib/agency/pago";

const validBody = {
  method_code: "efectivo" as const,
  amount: 100000,
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  confirm: true,
};

describe("PagoConfirmarSchema", () => {
  it("acepta un body válido (efectivo/transferencia)", () => {
    expect(PagoConfirmarSchema.safeParse(validBody).success).toBe(true);
    expect(
      PagoConfirmarSchema.safeParse({
        ...validBody,
        method_code: "transferencia",
      }).success,
    ).toBe(true);
  });

  it("rechaza method_code fuera de los manuales (ej. mercadopago — scope MP separado)", () => {
    expect(
      PagoConfirmarSchema.safeParse({
        ...validBody,
        method_code: "mercadopago",
      }).success,
    ).toBe(false);
  });

  it("amount: rechaza ≤0, >2 decimales, NaN/Infinity; acepta grandes de 2 decimales", () => {
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: 0 }).success,
    ).toBe(false);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: -5 }).success,
    ).toBe(false);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: 1.234 }).success,
    ).toBe(false);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: NaN }).success,
    ).toBe(false);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: Infinity }).success,
    ).toBe(false);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: 99999.99 }).success,
    ).toBe(true);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: 12345.67 }).success,
    ).toBe(true);
  });

  it("rechaza idempotency_key no-uuid", () => {
    expect(
      PagoConfirmarSchema.safeParse({
        ...validBody,
        idempotency_key: "no-es-uuid",
      }).success,
    ).toBe(false);
  });

  it("rechaza amount string o confirm no-boolean (boundary de tipos)", () => {
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, amount: "100000" }).success,
    ).toBe(false);
    expect(
      PagoConfirmarSchema.safeParse({ ...validBody, confirm: "true" }).success,
    ).toBe(false);
  });

  it("pago SIEMPRE obligatorio: no existe 'confirm sin pago' (Two-Pass cold P1-B)", () => {
    // method_code + amount son requeridos → no se puede confirmar sin registrar pago.
    // Cierra por construcción la combo confirm-sin-pago que el plan pedía rechazar.
    expect(PagoConfirmarSchema.safeParse({ confirm: true }).success).toBe(
      false,
    );
    expect(
      PagoConfirmarSchema.safeParse({
        idempotency_key: validBody.idempotency_key,
        confirm: true,
      }).success,
    ).toBe(false);
  });
});

describe("buildAgencyConfirmarReservaArgs", () => {
  it("arma los args del RPC con amount número + currency server-side + confirm", () => {
    const args = buildAgencyConfirmarReservaArgs("res-1", "ARS", validBody);
    expect(args).toEqual({
      p_reserva_id: "res-1",
      p_pago: {
        method_code: "efectivo",
        currency: "ARS",
        amount: 100000,
        idempotency_key: "11111111-1111-4111-8111-111111111111",
      },
      p_confirm: true,
    });
    expect(typeof args.p_pago.amount).toBe("number");
  });

  it("currency viene del parámetro server-side, no del body", () => {
    const args = buildAgencyConfirmarReservaArgs("res-2", "USD", validBody);
    expect(args.p_pago.currency).toBe("USD");
  });

  it("p_confirm refleja el input (permite pago sin confirmar)", () => {
    const args = buildAgencyConfirmarReservaArgs("res-3", "ARS", {
      ...validBody,
      confirm: false,
    });
    expect(args.p_confirm).toBe(false);
  });
});
