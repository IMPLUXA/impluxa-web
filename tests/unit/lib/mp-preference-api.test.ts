import { describe, it, expect, vi, afterEach } from "vitest";
import { createCheckoutProPreference } from "@/lib/mp/preference-api";
import type { CheckoutProPreferenceBody } from "@/lib/mp/preference";

// F3 — transporte createCheckoutProPreference: POST a MP con el token del vendedor,
// allowlist de respuesta (id + init_point), fail-closed en error. fetch mockeado (sin red).

const BODY: CheckoutProPreferenceBody = {
  items: [
    {
      title: "Reserva abcd1234",
      quantity: 1,
      unit_price: 1000,
      currency_id: "ARS",
    },
  ],
  external_reference: "tenant-1:reserva-1",
  back_urls: {
    success: "https://x.test/app?mp=return",
    pending: "https://x.test/app?mp=return",
    failure: "https://x.test/app?mp=return",
  },
  auto_return: "approved",
  notification_url: "https://x.test/api/mp/webhook?source_news=webhooks",
};

function mockRes(status: number, jsonBody: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCheckoutProPreference", () => {
  it("devuelve SOLO { id, init_point } (allowlist; descarta collector_id/sandbox_init_point/client_id)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockRes(201, {
          id: "pref-123",
          init_point: "https://mp/checkout/pref-123",
          sandbox_init_point: "https://sandbox/pref-123",
          collector_id: 182102575,
          client_id: "7696978462743663",
        }),
      ),
    );
    const r = await createCheckoutProPreference("APP_USR-token", BODY);
    expect(r).toEqual({
      id: "pref-123",
      init_point: "https://mp/checkout/pref-123",
    });
    // Anti-leak: NINGUN campo extra del body crudo de MP sobrevive.
    expect(Object.keys(r).sort()).toEqual(["id", "init_point"]);
  });

  it("manda Authorization: Bearer con el token del vendedor", async () => {
    const fetchMock = vi.fn((_url: string, _opts?: RequestInit) =>
      Promise.resolve(mockRes(201, { id: "p", init_point: "https://mp/p" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await createCheckoutProPreference("APP_USR-secret-xyz", BODY);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.headers).toMatchObject({
      authorization: "Bearer APP_USR-secret-xyz",
    });
    // Pega al endpoint correcto de preferencias.
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.mercadopago.com/checkout/preferences",
    );
  });

  it("throw en status !ok (fail-closed)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockRes(400, { error: "bad_request" })),
    );
    await expect(createCheckoutProPreference("t", BODY)).rejects.toThrow(/400/);
  });

  it("throw si la respuesta 201 no trae id/init_point", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockRes(201, { id: "p" })),
    );
    await expect(createCheckoutProPreference("t", BODY)).rejects.toThrow(
      /id\/init_point/,
    );
  });
});
