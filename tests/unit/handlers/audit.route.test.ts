import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { ssrAuthMock, ssrFromMock, writeAuditMock } = vi.hoisted(() => ({
  ssrAuthMock: { getUser: vi.fn() },
  ssrFromMock: vi.fn(),
  writeAuditMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi
    .fn()
    .mockResolvedValue({ auth: ssrAuthMock, from: ssrFromMock }),
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

beforeEach(() => {
  ssrAuthMock.getUser.mockReset();
  ssrFromMock.mockReset();
  writeAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/audit (W3.G3.T4, FR-AUTH-7, D4 Opción B)", () => {
  it("returns 401 when no authenticated user", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 400 when ?tenant query param is missing", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    const req = new NextRequest("http://app.impluxa.com/api/audit");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 200 with audit rows filtered by RLS for authed user", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
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
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
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
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    mockSelect([], { message: "rls denied", code: "42501" });

    const req = new NextRequest(
      `http://app.impluxa.com/api/audit?tenant=${TENANT_A}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("does NOT throw when meta-audit insert fails — primary read response is preserved", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
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
