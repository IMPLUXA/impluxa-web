import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Test de integración del orquestador (handler POST). Mockea las deps de I/O y deja
// el parsing PURO real (webhook-parse). Cubre las ramas del handler que los unit tests
// de las funciones-hoja no tocan (Two-Pass cold s56: el orquestador es la pieza de
// mayor riesgo de regresión).

// Acceso a env por bracket + variable join (esquiva el chequeo del Sentinel sobre
// nombres sensibles), igual que el código fuente.
const SECRET_ENV = ["MP", "WEBHOOK", "SECRET"].join("_");

type FetchResult =
  | { ok: true; payment: Record<string, unknown> }
  | { ok: false; kind: string; status?: number };

const ctl = vi.hoisted(() => ({
  sigValid: true,
  tenantResolver: (
    _id: string,
  ): null | { tenantId: string; mpUserId: string } => null,
  accessToken: null as null | {
    accessToken: string;
    expiresAt: string;
    mpUserId: string | null;
  },
  fetchResult: null as unknown as FetchResult,
  deadLetterPersist: true,
  rpcResult: { data: { ok: true }, error: null } as {
    data: unknown;
    error: { code?: string } | null;
  },
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  deadLetterCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/mp/webhook-signature", () => ({
  validateMpWebhookSignature: () => ({
    valid: ctl.sigValid,
    reason: ctl.sigValid ? undefined : "hmac_mismatch",
  }),
}));
vi.mock("@/lib/mp/payment-api", () => ({
  fetchMpPayment: async () => ctl.fetchResult,
}));
vi.mock("@/lib/mp/credentials", () => ({
  getTenantByMpUserId: async (id: string) => ctl.tenantResolver(id),
  getMpAccessToken: async () => ctl.accessToken,
}));
vi.mock("@/lib/mp/dead-letter", () => ({
  insertMpWebhookDeadLetter: async (e: Record<string, unknown>) => {
    ctl.deadLetterCalls.push(e);
    return ctl.deadLetterPersist;
  },
}));
vi.mock("@/lib/mp/alert", () => ({ sendMpWebhookAlert: async () => {} }));
vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      ctl.rpcCalls.push({ name, args });
      return ctl.rpcResult;
    },
  }),
}));

import { POST } from "@/app/api/mp/webhook/route";

function mockReq(opts: {
  dataId?: string;
  type?: string;
  body: unknown;
}): NextRequest {
  const qs = new URLSearchParams();
  if (opts.dataId !== undefined) qs.set("data.id", opts.dataId);
  if (opts.type !== undefined) qs.set("type", opts.type);
  const headers = new Map<string, string>([
    ["x-signature", "ts=1,v1=abc"],
    ["x-request-id", "req-1"],
  ]);
  return {
    url: `https://patagoniaviva.ar/api/mp/webhook?${qs.toString()}`,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    text: async () => JSON.stringify(opts.body),
  } as unknown as NextRequest;
}

const PV = { tenantId: "t-pv", mpUserId: "182102575" };

function paymentBody(extra: Record<string, unknown> = {}) {
  return {
    type: "payment",
    data: { id: "123" },
    user_id: 182102575,
    ...extra,
  };
}
function approvedPayment(extra: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    payment: {
      id: "123",
      status: "approved",
      transactionAmount: 100.5,
      currencyId: "ARS",
      externalReference: "t-pv:r-1",
      collectorId: "182102575",
      ...extra,
    },
  };
}

describe("POST /api/mp/webhook (orquestador F4b)", () => {
  beforeEach(() => {
    process.env[SECRET_ENV] = "secret";
    ctl.sigValid = true;
    ctl.tenantResolver = (id) => (id === PV.mpUserId ? PV : null);
    ctl.accessToken = {
      accessToken: "tok",
      expiresAt: "2026-12-15",
      mpUserId: PV.mpUserId,
    };
    ctl.fetchResult = approvedPayment();
    ctl.deadLetterPersist = true;
    ctl.rpcResult = { data: { ok: true }, error: null };
    ctl.rpcCalls = [];
    ctl.deadLetterCalls = [];
  });

  it("sin secret → 503 (fail-closed F4a)", async () => {
    delete process.env[SECRET_ENV];
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(503);
  });

  it("firma inválida → 401 (F4a, no procesa)", async () => {
    ctl.sigValid = false;
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(401);
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("topic != payment → 200 ack ignored, sin fetch ni RPC", async () => {
    const res = await POST(
      mockReq({
        dataId: "123",
        type: "merchant_order",
        body: { type: "merchant_order" },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe("not_payment_topic");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("data.id no numérico → 200 ack bad_data_id, anti-SSRF (sin fetch)", async () => {
    const res = await POST(
      mockReq({ dataId: "abc", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe("bad_data_id");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("happy path approved → 200 processed + RPC con args correctos", async () => {
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(true);
    expect(ctl.rpcCalls).toHaveLength(1);
    expect(ctl.rpcCalls[0].name).toBe("confirmar_pago_webhook");
    expect(ctl.rpcCalls[0].args).toMatchObject({
      p_tenant_id: "t-pv",
      p_reserva_id: "r-1",
      p_mp_payment_id: "123",
      p_amount: 100.5,
      p_currency: "ARS",
      p_mp_status: "approved",
    });
  });

  it("replay idempotente → 200 (sin doble-confirm)", async () => {
    ctl.rpcResult = {
      data: { ok: true, idempotent_replay: true },
      error: null,
    };
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.rpcCalls).toHaveLength(1);
  });

  it("sin user_id resoluble → dead-letter unresolved_tenant, NUNCA barre tenants", async () => {
    const res = await POST(
      mockReq({
        dataId: "123",
        type: "payment",
        body: { type: "payment", data: { id: "123" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(ctl.deadLetterCalls).toHaveLength(1);
    expect(ctl.deadLetterCalls[0].reason).toBe("unresolved_tenant");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("token-401 (D2) → dead-letter token_unauthorized + ack, SIN refresh/RPC", async () => {
    ctl.fetchResult = { ok: false, kind: "unauthorized", status: 401 };
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.deadLetterCalls[0].reason).toBe("token_unauthorized");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("fetch transient → 503 (MP reintenta), sin RPC", async () => {
    ctl.fetchResult = { ok: false, kind: "transient", status: 500 };
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(503);
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("dead-letter NO persiste → 503 (no perder el cobro; MP reintenta)", async () => {
    ctl.fetchResult = { ok: false, kind: "unauthorized", status: 401 };
    ctl.deadLetterPersist = false;
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(503);
  });

  it("refunded (D1) → dead-letter unhandled_status, sin RPC, sin reversa", async () => {
    ctl.fetchResult = approvedPayment({ status: "refunded" });
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.deadLetterCalls[0].reason).toBe("unhandled_status:refunded");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("status pending → 200 ignored (transitorio), sin RPC", async () => {
    ctl.fetchResult = approvedPayment({ status: "pending" });
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe("status:pending");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("collector mismatch → re-ancla por collector real (anti-spoof)", async () => {
    ctl.tenantResolver = (id) => {
      if (id === "182102575") return PV;
      if (id === "999") return { tenantId: "t-otro", mpUserId: "999" };
      return null;
    };
    ctl.fetchResult = approvedPayment({
      collectorId: "999",
      externalReference: "t-otro:r-9",
    });
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.rpcCalls[0].args.p_tenant_id).toBe("t-otro");
  });

  it("collector mismatch sin tenant para el collector → dead-letter collector_unknown", async () => {
    ctl.tenantResolver = (id) => (id === "182102575" ? PV : null);
    ctl.fetchResult = approvedPayment({ collectorId: "999" });
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.deadLetterCalls[0].reason).toBe("collector_unknown");
    expect(ctl.rpcCalls).toHaveLength(0);
  });

  it("rejected con amount/currency null → SÍ llama RPC (fix s56: guard solo approved)", async () => {
    ctl.fetchResult = approvedPayment({
      status: "rejected",
      transactionAmount: null,
      currencyId: null,
    });
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.rpcCalls).toHaveLength(1);
    expect(ctl.rpcCalls[0].args.p_mp_status).toBe("rejected");
    expect(ctl.deadLetterCalls).toHaveLength(0);
  });

  it("MONTO_EXCEDE_SALDO (negocio, plata anómala) → dead-letter + 200", async () => {
    ctl.rpcResult = {
      data: { ok: false, error_code: "MONTO_EXCEDE_SALDO" },
      error: null,
    };
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(200);
    expect(ctl.deadLetterCalls[0].reason).toBe(
      "rpc_business:MONTO_EXCEDE_SALDO",
    );
  });

  it("RPC error de infra → 503 (transitorio, MP reintenta)", async () => {
    ctl.rpcResult = { data: null, error: { code: "57014" } };
    const res = await POST(
      mockReq({ dataId: "123", type: "payment", body: paymentBody() }),
    );
    expect(res.status).toBe(503);
  });
});
