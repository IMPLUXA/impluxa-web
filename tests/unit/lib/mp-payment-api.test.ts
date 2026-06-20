import { describe, expect, it, vi, afterEach } from "vitest";
import { toMpPayment, fetchMpPayment } from "@/lib/mp/payment-api";

describe("toMpPayment (defensivo, allowlist)", () => {
  it("collector_id top-level", () => {
    const p = toMpPayment({
      id: 123,
      status: "approved",
      transaction_amount: 100.5,
      currency_id: "ARS",
      external_reference: "t:r",
      collector_id: 182102575,
      payer: { email: "secreto@x.com" }, // PII → NO debe aparecer
    });
    expect(p).toEqual({
      id: "123",
      status: "approved",
      statusDetail: null,
      transactionAmount: 100.5,
      currencyId: "ARS",
      externalReference: "t:r",
      collectorId: "182102575",
    });
  });

  it("collector anidado en collector.id (forma alternativa)", () => {
    const p = toMpPayment({
      id: "9",
      status: "approved",
      collector: { id: 555 },
    });
    expect(p?.collectorId).toBe("555");
  });

  it("sin id → null (shape inválido)", () => {
    expect(toMpPayment({ status: "approved" })).toBeNull();
    expect(toMpPayment(null)).toBeNull();
  });
});

describe("fetchMpPayment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function resp(status: number, body: unknown, ok = status < 400) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it("200 con payload válido → ok:true", async () => {
    global.fetch = vi.fn(async () =>
      resp(200, { id: "1", status: "approved", collector_id: 7 }),
    ) as unknown as typeof fetch;
    const r = await fetchMpPayment("tok", "1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payment.collectorId).toBe("7");
  });

  it("200 con json roto → bad_response", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    })) as unknown as typeof fetch;
    const r = await fetchMpPayment("tok", "1");
    expect(r).toMatchObject({ ok: false, kind: "bad_response" });
  });

  it("404 → not_found", async () => {
    global.fetch = vi.fn(async () =>
      resp(404, { message: "not found" }),
    ) as unknown as typeof fetch;
    const r = await fetchMpPayment("tok", "1");
    expect(r).toMatchObject({ ok: false, kind: "not_found", status: 404 });
  });

  it("401/403 → unauthorized (token vencido/revocado)", async () => {
    for (const s of [401, 403]) {
      global.fetch = vi.fn(async () =>
        resp(s, { message: "unauth" }),
      ) as unknown as typeof fetch;
      const r = await fetchMpPayment("tok", "1");
      expect(r).toMatchObject({ ok: false, kind: "unauthorized", status: s });
    }
  });

  it("429 y 5xx → transient (reintentable)", async () => {
    for (const s of [429, 500, 503]) {
      global.fetch = vi.fn(async () => resp(s, {})) as unknown as typeof fetch;
      const r = await fetchMpPayment("tok", "1");
      expect(r).toMatchObject({ ok: false, kind: "transient" });
    }
  });

  it("otro 4xx (400) → bad_response (no-reintentable)", async () => {
    global.fetch = vi.fn(async () => resp(400, {})) as unknown as typeof fetch;
    const r = await fetchMpPayment("tok", "1");
    expect(r).toMatchObject({ ok: false, kind: "bad_response", status: 400 });
  });

  it("network error (fetch throw) → transient", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const r = await fetchMpPayment("tok", "1");
    expect(r).toMatchObject({ ok: false, kind: "transient" });
  });

  it("timeout (AbortController 10s) → transient", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn(
      (_url: unknown, opts: unknown) =>
        new Promise((_resolve, reject) => {
          const signal = (opts as { signal: AbortSignal }).signal;
          signal.addEventListener("abort", () =>
            reject(new Error("AbortError")),
          );
        }),
    ) as unknown as typeof fetch;
    const p = fetchMpPayment("tok", "123");
    await vi.advanceTimersByTimeAsync(10_001);
    const r = await p;
    expect(r).toMatchObject({ ok: false, kind: "transient" });
  });
});
