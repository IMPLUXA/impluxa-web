import { describe, it, expect } from "vitest";
import {
  IniciarPagoMpSchema,
  buildIniciarPagoMpArgs,
} from "@/lib/agency/pago-mp";

// F3 — contrato del schema + builder de args del RPC agency_iniciar_pago_mp.
// El monto autoritativo lo re-valida el RPC/webhook; el schema solo evita basura.

describe("IniciarPagoMpSchema", () => {
  it("acepta amount > 0 con escala 2", () => {
    expect(IniciarPagoMpSchema.safeParse({ amount: 1500.5 }).success).toBe(
      true,
    );
    expect(IniciarPagoMpSchema.safeParse({ amount: 0.01 }).success).toBe(true);
    expect(IniciarPagoMpSchema.safeParse({ amount: 1000000 }).success).toBe(
      true,
    );
  });

  it("rechaza amount <= 0", () => {
    expect(IniciarPagoMpSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(IniciarPagoMpSchema.safeParse({ amount: -10 }).success).toBe(false);
  });

  it("rechaza mas de 2 decimales (espeja round(amount,2) del RPC)", () => {
    expect(IniciarPagoMpSchema.safeParse({ amount: 10.123 }).success).toBe(
      false,
    );
  });

  it("rechaza amount no-numerico", () => {
    expect(IniciarPagoMpSchema.safeParse({ amount: "10" }).success).toBe(false);
    expect(IniciarPagoMpSchema.safeParse({ amount: null }).success).toBe(false);
    expect(IniciarPagoMpSchema.safeParse({}).success).toBe(false);
  });

  it("rechaza Infinity/NaN", () => {
    expect(IniciarPagoMpSchema.safeParse({ amount: Infinity }).success).toBe(
      false,
    );
    expect(IniciarPagoMpSchema.safeParse({ amount: NaN }).success).toBe(false);
  });

  it("strippea campos ajenos al contrato (no method_code / idempotency_key / confirm)", () => {
    const r = IniciarPagoMpSchema.safeParse({
      amount: 10,
      method_code: "mercadopago",
      idempotency_key: "x",
      confirm: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data)).toEqual(["amount"]);
    }
  });
});

describe("buildIniciarPagoMpArgs", () => {
  it("inyecta currency server-side y arma el shape del RPC", () => {
    const args = buildIniciarPagoMpArgs("res-1", "ARS", { amount: 2500 });
    expect(args).toEqual({
      p_reserva_id: "res-1",
      p_pago: { amount: 2500, currency: "ARS" },
    });
  });

  it("la currency viene del parametro (snapshot), no del input del cliente", () => {
    const args = buildIniciarPagoMpArgs("res-2", "USD", { amount: 99.99 });
    expect(args.p_pago.currency).toBe("USD");
    expect(args.p_pago.amount).toBe(99.99);
  });
});
