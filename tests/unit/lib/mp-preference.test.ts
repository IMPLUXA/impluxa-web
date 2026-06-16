import { describe, expect, it } from "vitest";
import { buildCheckoutProPreferenceBody } from "@/lib/mp/preference";

const base = {
  reservaId: "11111111-1111-1111-1111-111111111111",
  amount: 100000,
  currency: "ARS" as const,
  title: "Reserva PV-0001",
  backUrls: {
    success: "https://patagoniaviva.ar/pago/exito",
    pending: "https://patagoniaviva.ar/pago/pendiente",
    failure: "https://patagoniaviva.ar/pago/error",
  },
  notificationUrl: "https://patagoniaviva.ar/api/mp/webhook",
};

describe("buildCheckoutProPreferenceBody", () => {
  it("arma el body con la forma documentada por MP", () => {
    const b = buildCheckoutProPreferenceBody(base);
    expect(b.items).toHaveLength(1);
    expect(b.items[0]).toMatchObject({
      title: "Reserva PV-0001",
      quantity: 1,
      unit_price: 100000, // B1: = snapshot_gross
      currency_id: "ARS",
    });
    expect(b.external_reference).toBe(base.reservaId);
    expect(b.back_urls).toEqual(base.backUrls);
    expect(b.auto_return).toBe("approved");
  });

  it("notification_url lleva source_news=webhooks (solo Webhooks, no IPN)", () => {
    const b = buildCheckoutProPreferenceBody(base);
    const u = new URL(b.notification_url);
    expect(u.searchParams.get("source_news")).toBe("webhooks");
    expect(u.origin + u.pathname).toBe(
      "https://patagoniaviva.ar/api/mp/webhook",
    );
  });

  it("NO incluye marketplace_fee ni application_fee (Impluxa no retiene cut)", () => {
    const b = buildCheckoutProPreferenceBody(base);
    expect("marketplace_fee" in b).toBe(false);
    expect("application_fee" in b).toBe(false);
    // anclado a las CLAVES del body (no al string libre): un title legítimo con
    // "fee" (ej. "Coffee Tour") no dispara falso-positivo (Two-Pass cold P2).
    expect(JSON.stringify(b)).not.toMatch(
      /"(marketplace_fee|application_fee)"/,
    );
  });

  it("título con 'fee' (Coffee Tour) no introduce clave de fee", () => {
    const b = buildCheckoutProPreferenceBody({ ...base, title: "Coffee Tour" });
    expect("marketplace_fee" in b).toBe(false);
    expect("application_fee" in b).toBe(false);
    expect(b.items[0].title).toBe("Coffee Tour");
  });

  it("incluye id del item solo si se pasa", () => {
    expect(buildCheckoutProPreferenceBody(base).items[0].id).toBeUndefined();
    expect(
      buildCheckoutProPreferenceBody({ ...base, itemId: "item-42" }).items[0]
        .id,
    ).toBe("item-42");
  });

  it("auto_return configurable (default approved)", () => {
    expect(
      buildCheckoutProPreferenceBody({ ...base, autoReturn: "all" })
        .auto_return,
    ).toBe("all");
  });

  it("fail-closed: amount <= 0 o con > 2 decimales", () => {
    expect(() =>
      buildCheckoutProPreferenceBody({ ...base, amount: 0 }),
    ).toThrow(/amount/);
    expect(() =>
      buildCheckoutProPreferenceBody({ ...base, amount: -5 }),
    ).toThrow(/amount/);
    expect(() =>
      buildCheckoutProPreferenceBody({ ...base, amount: 1.234 }),
    ).toThrow(/amount/);
  });

  it("fail-closed: currency inválida", () => {
    expect(() =>
      buildCheckoutProPreferenceBody({
        ...base,
        currency: "EUR" as unknown as "ARS", // bypass compile-time; prueba el guard runtime
      }),
    ).toThrow(/currency/);
  });

  it("fail-closed: title o reservaId vacíos", () => {
    expect(() =>
      buildCheckoutProPreferenceBody({ ...base, title: "  " }),
    ).toThrow(/title/);
    expect(() =>
      buildCheckoutProPreferenceBody({ ...base, reservaId: "" }),
    ).toThrow(/reservaId/);
  });

  it("fail-closed: URLs no-https (MP rechaza dominios locales)", () => {
    expect(() =>
      buildCheckoutProPreferenceBody({
        ...base,
        notificationUrl: "http://localhost:3000/api/mp/webhook",
      }),
    ).toThrow(/https/);
    expect(() =>
      buildCheckoutProPreferenceBody({
        ...base,
        backUrls: { ...base.backUrls, success: "http://patagoniaviva.ar/x" },
      }),
    ).toThrow(/https/);
  });

  it("fail-closed: notification_url malformada", () => {
    expect(() =>
      buildCheckoutProPreferenceBody({ ...base, notificationUrl: "no-es-url" }),
    ).toThrow(/URL válida|https/);
  });

  it("montos grandes con 2 decimales PASAN (sin falso-positivo de escala/float)", () => {
    for (const amount of [99999.99, 12345.67, 0.01, 1000000.0]) {
      const b = buildCheckoutProPreferenceBody({ ...base, amount });
      expect(b.items[0].unit_price).toBe(amount);
    }
  });

  it("notification_url con query previa: preserva y agrega source_news", () => {
    const b = buildCheckoutProPreferenceBody({
      ...base,
      notificationUrl: "https://patagoniaviva.ar/api/mp/webhook?foo=bar",
    });
    const u = new URL(b.notification_url);
    expect(u.searchParams.get("foo")).toBe("bar");
    expect(u.searchParams.get("source_news")).toBe("webhooks");
  });
});
