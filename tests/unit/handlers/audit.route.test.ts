import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { guardMock, ssrFromMock, writeAuditMock } = vi.hoisted(() => ({
  guardMock: vi.fn(),
  ssrFromMock: vi.fn(),
  writeAuditMock: vi.fn(),
}));

// W1.T2: route now calls requireActiveTenantOrResponse() before any other
// work. Mocking the guard avoids loading runtime-config (which fires
// requireEnv at import time and breaks in local test envs without
// NEXT_PUBLIC_SUPABASE_URL set).
vi.mock("@/lib/auth/guard", () => ({
  requireActiveTenantOrResponse: guardMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({ from: ssrFromMock }),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditEvent: writeAuditMock,
}));

import { GET } from "@/app/api/audit/route";

const TENANT_A = "00000000-0000-0000-0000-000000000aaa";
const USER_X = "00000000-0000-0000-0000-000000000fff";

function mockSelect(rows: unknown[] = [], error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error }),
  };
  ssrFromMock.mockReturnValue(chain);
  return chain;
}

function mockGuardOk(userId: string = USER_X, tenantId: string = TENANT_A) {
  guardMock.mockResolvedValue({
    ok: true,
    user: { id: userId },
    tenantId,
  });
}

function mockGuardReject(status: 401 | 403, code: "E_AUTH" | "E_TENANT_CLAIM") {
  guardMock.mockResolvedValue({
    ok: false,
    response: NextResponse.json(
      { error: status === 401 ? "unauthorized" : "forbidden", code },
      { status },
    ),
  });
}

beforeEach(() => {
  guardMock.mockReset();
  ssrFromMock.mockReset();
  writeAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/audit (W3.G3.T4, FR-AUTH-7, D4 Opción B + W1.T2)", () => {
  it("returns 401 when guard rejects unauthenticated", async () => {
    mockGuardReject(401, "E_AUTH");
    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 403 when guard rejects missing tenant claim (W1.T2)", async () => {
    mockGuardReject(403, "E_TENANT_CLAIM");
    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("E_TENANT_CLAIM");
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 400 when ?tenant query param is missing", async () => {
    mockGuardOk();
    const req = new NextRequest("http://app.impluxa.com/api/audit");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 200 with audit rows filtered by RLS for authed user", async () => {
    mockGuardOk();
    const rows = [
      {
        id: 1,
        occurred_at: "2026-05-14T12:00:00Z",
        action: "site.publish",
        actor_user_id: USER_X,
        acting_as_tenant_id: TENANT_A,
        record_hash: "abc",
        prev_record_hash: null,
      },
    ];
    mockSelect(rows, null);

    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ events: rows });
  });

  it("calls writeAuditEvent with action=audit.read after returning rows", async () => {
    mockGuardOk();
    mockSelect([], null);

    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    await GET(req);
    expect(writeAuditMock).toHaveBeenCalledOnce();
    const event = writeAuditMock.mock.calls[0][0];
    expect(event.action).toBe("audit.read");
    expect(event.actor_user_id).toBe(USER_X);
    expect(event.acting_as_tenant_id).toBe(TENANT_A);
    expect(event.resource_type).toBe("audit_log");
  });

  it("returns 500 when audit_log query returns a Supabase error", async () => {
    mockGuardOk();
    mockSelect([], { message: "rls denied", code: "42501" });

    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("does NOT throw when meta-audit insert fails — primary read response is preserved", async () => {
    mockGuardOk();
    mockSelect([], null);
    writeAuditMock.mockRejectedValueOnce(new Error("downstream write fail"));

    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    // The primary contract is "give the data". A failed audit.read meta-event
    // is logged but does NOT fail the user's GET. Otherwise an audit outage
    // would deny everyone read access — worse than the missing meta row.
    expect(res.status).toBe(200);
  });
});
