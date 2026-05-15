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

import { POST } from "@/app/api/tenant/switch/route";

// Real UUIDv4 values — zod 4 z.uuid() validates RFC 4122 versions strictly,
// rejecting non-versioned hex like "0000-...-000aaa".
const USER_X = "a8c5d9e2-7b3f-4a91-b5d6-e0c1f2a3b4c5";
const TENANT_A = "b1d3e5f7-9a2c-4e6b-8d0f-1a3c5e7f9b1d";
const TENANT_B = "c2e4f6a8-b0d2-4f4e-9c1a-2b4d6f8a0c2e";

function makeMembershipQuery(matchedRow: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: matchedRow, error: null }),
  };
}

function makeTenantQuery(matchedRow: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: matchedRow, error: null }),
  };
}

function makeUpsertQuery(error: unknown = null) {
  return {
    upsert: vi.fn().mockResolvedValue({ error }),
  };
}

function mkPost(body: unknown): NextRequest {
  // NextRequest with a body in vitest/jsdom env has flaky stream behavior;
  // expose a minimal shape with .json() that the route uses.
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

function mkPostInvalid(): NextRequest {
  return {
    json: async () => {
      throw new Error("invalid json");
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  ssrAuthMock.getUser.mockReset();
  ssrFromMock.mockReset();
  writeAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/tenant/switch (W3.G5.T1, FR-AUTH-5)", () => {
  it("returns 401 when no authenticated user", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const res = await POST(mkPost({ tenant_id: TENANT_A }));
    expect(res.status).toBe(401);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is missing tenant_id or malformed UUID", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    const res = await POST(mkPost({ tenant_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is NOT a member of the requested tenant", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    // membership lookup returns null (RLS or no row)
    ssrFromMock.mockImplementationOnce(() => makeMembershipQuery(null));

    const res = await POST(mkPost({ tenant_id: TENANT_B }));
    expect(res.status).toBe(403);
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("returns 200 with redirectTo when membership is valid and updates user_session_state", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    const membershipQ = makeMembershipQuery({
      tenant_id: TENANT_A,
      user_id: USER_X,
      role: "editor",
    });
    const upsertQ = makeUpsertQuery(null);
    const tenantQ = makeTenantQuery({ slug: "rls-claim-a" });

    ssrFromMock
      .mockImplementationOnce(() => membershipQ) // tenant_members membership check
      .mockImplementationOnce(() => upsertQ) // user_session_state upsert
      .mockImplementationOnce(() => tenantQ); // tenants slug lookup

    const res = await POST(mkPost({ tenant_id: TENANT_A }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/t/rls-claim-a/dashboard");

    // upsert was called with the right shape
    expect(upsertQ.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_X,
        active_tenant_id: TENANT_A,
      }),
      expect.anything(),
    );
  });

  it("writes audit event action=tenant.switched on successful switch", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    ssrFromMock
      .mockImplementationOnce(() =>
        makeMembershipQuery({
          tenant_id: TENANT_A,
          user_id: USER_X,
          role: "owner",
        }),
      )
      .mockImplementationOnce(() => makeUpsertQuery(null))
      .mockImplementationOnce(() => makeTenantQuery({ slug: "rls-claim-a" }));

    await POST(mkPost({ tenant_id: TENANT_A }));

    expect(writeAuditMock).toHaveBeenCalledOnce();
    const event = writeAuditMock.mock.calls[0][0];
    expect(event.action).toBe("tenant.switched");
    expect(event.actor_user_id).toBe(USER_X);
    expect(event.acting_as_tenant_id).toBe(TENANT_A);
  });

  it("returns 500 when user_session_state upsert fails", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    ssrFromMock
      .mockImplementationOnce(() =>
        makeMembershipQuery({
          tenant_id: TENANT_A,
          user_id: USER_X,
          role: "editor",
        }),
      )
      .mockImplementationOnce(() => makeUpsertQuery({ message: "rls denied" }));

    const res = await POST(mkPost({ tenant_id: TENANT_A }));
    expect(res.status).toBe(500);
  });

  it("falls back to /app/dashboard when tenant slug lookup fails (still ok=true)", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    ssrFromMock
      .mockImplementationOnce(() =>
        makeMembershipQuery({
          tenant_id: TENANT_A,
          user_id: USER_X,
          role: "editor",
        }),
      )
      .mockImplementationOnce(() => makeUpsertQuery(null))
      .mockImplementationOnce(() => makeTenantQuery(null));

    const res = await POST(mkPost({ tenant_id: TENANT_A }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/app/dashboard");
  });

  it("audit failure does NOT abort the switch (best-effort meta-event)", async () => {
    ssrAuthMock.getUser.mockResolvedValue({
      data: { user: { id: USER_X } },
      error: null,
    });
    ssrFromMock
      .mockImplementationOnce(() =>
        makeMembershipQuery({
          tenant_id: TENANT_A,
          user_id: USER_X,
          role: "editor",
        }),
      )
      .mockImplementationOnce(() => makeUpsertQuery(null))
      .mockImplementationOnce(() => makeTenantQuery({ slug: "rls-claim-a" }));
    writeAuditMock.mockRejectedValueOnce(new Error("audit down"));

    const res = await POST(mkPost({ tenant_id: TENANT_A }));
    // Switch principal succeeded; audit failure logged but not user-visible.
    expect(res.status).toBe(200);
  });
});
