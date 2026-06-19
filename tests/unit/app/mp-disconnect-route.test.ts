import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Test del endpoint POST /api/mp/oauth/disconnect (UI-connect s57). Mockea las deps de
// I/O (guard, rol, supabase rpc, setMpStatus) y verifica: guard, CSRF, role-gate, el
// warn de pagos-en-tránsito (pending>0 sin confirm NO revoca) y el revoke con confirm.

const ctl = vi.hoisted(() => ({
  guard: { ok: true, tenantId: "t-pv", user: { id: "u1" } } as
    | { ok: true; tenantId: string; user: { id: string } }
    | { ok: false; response: Response },
  role: "dueno_admin" as string | null,
  rpcResult: { data: { ok: true, pending: 0 }, error: null } as {
    data: unknown;
    error: { code?: string } | null;
  },
  setStatusCalls: [] as Array<{ tenantId: string; status: string }>,
  setStatusThrows: false,
}));

vi.mock("@/lib/auth/guard", () => ({
  requireActiveTenantOrResponse: async () => ctl.guard,
}));
vi.mock("@/lib/agency/role", () => ({
  getAgencyRole: async () => ctl.role,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    rpc: async (_name: string) => ctl.rpcResult,
  }),
}));
vi.mock("@/lib/mp/credentials", () => ({
  setMpStatus: async (tenantId: string, status: string) => {
    if (ctl.setStatusThrows) throw new Error("db down");
    ctl.setStatusCalls.push({ tenantId, status });
  },
}));

import { POST } from "@/app/api/mp/oauth/disconnect/route";

function mockReq(opts: {
  origin?: string;
  host?: string;
  body?: unknown;
}): NextRequest {
  const headers = new Map<string, string>();
  if (opts.host) headers.set("host", opts.host);
  if (opts.origin) headers.set("origin", opts.origin);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => (opts.body === undefined ? {} : opts.body),
  } as unknown as NextRequest;
}

describe("POST /api/mp/oauth/disconnect", () => {
  beforeEach(() => {
    ctl.guard = { ok: true, tenantId: "t-pv", user: { id: "u1" } };
    ctl.role = "dueno_admin";
    ctl.rpcResult = { data: { ok: true, pending: 0 }, error: null };
    ctl.setStatusCalls = [];
    ctl.setStatusThrows = false;
    delete process.env.VERCEL_ENV;
  });

  it("sin sesión activa → devuelve la response del guard", async () => {
    ctl.guard = { ok: false, response: new Response(null, { status: 401 }) };
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    expect(res.status).toBe(401);
    expect(ctl.setStatusCalls).toHaveLength(0);
  });

  it("Origin que no matchea host → 403 E_ORIGIN", async () => {
    const res = await POST(
      mockReq({ host: "patagoniaviva.ar", origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("E_ORIGIN");
    expect(ctl.setStatusCalls).toHaveLength(0);
  });

  it("rol vendedor → 403 E_ROLE, NO revoca", async () => {
    ctl.role = "vendedor";
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("E_ROLE");
    expect(ctl.setStatusCalls).toHaveLength(0);
  });

  it("VERCEL_ENV=preview → 403 E_NON_PROD (guard SIGNAL-14, no muta prod desde preview)", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("E_NON_PROD");
    expect(ctl.setStatusCalls).toHaveLength(0);
  });

  it("rol encargado permitido → revoca + 200 (sin pendientes)", async () => {
    ctl.role = "encargado";
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.disconnected).toBe(true);
    expect(ctl.setStatusCalls).toEqual([
      { tenantId: "t-pv", status: "revoked" },
    ]);
  });

  it("pendientes > 0 sin confirmar → 200 disconnected:false + pending, NO revoca", async () => {
    ctl.rpcResult = { data: { ok: true, pending: 3 }, error: null };
    const res = await POST(mockReq({ host: "patagoniaviva.ar", body: {} }));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.disconnected).toBe(false);
    expect(j.pending).toBe(3);
    expect(ctl.setStatusCalls).toHaveLength(0);
  });

  it("pendientes > 0 con confirm:true → revoca + 200 disconnected:true", async () => {
    ctl.rpcResult = { data: { ok: true, pending: 3 }, error: null };
    const res = await POST(
      mockReq({ host: "patagoniaviva.ar", body: { confirm: true } }),
    );
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.disconnected).toBe(true);
    expect(ctl.setStatusCalls).toEqual([
      { tenantId: "t-pv", status: "revoked" },
    ]);
  });

  it("sin pendientes → revoca directo (sin confirm) + 200", async () => {
    ctl.rpcResult = { data: { ok: true, pending: 0 }, error: null };
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.disconnected).toBe(true);
    expect(ctl.setStatusCalls).toEqual([
      { tenantId: "t-pv", status: "revoked" },
    ]);
  });

  it("RPC error → 500 fail-closed, NO revoca", async () => {
    ctl.rpcResult = { data: null, error: { code: "57014" } };
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    expect(res.status).toBe(500);
    expect(ctl.setStatusCalls).toHaveLength(0);
  });

  it("setMpStatus tira → 500, no claim de disconnected", async () => {
    ctl.setStatusThrows = true;
    const res = await POST(mockReq({ host: "patagoniaviva.ar" }));
    expect(res.status).toBe(500);
  });
});
