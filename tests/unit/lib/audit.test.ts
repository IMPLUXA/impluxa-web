import { afterEach, describe, expect, it, vi } from "vitest";

const { rpcMock, getServiceMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return {
    rpcMock,
    getServiceMock: vi.fn(() => ({ rpc: rpcMock })),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: getServiceMock,
}));

import { writeAuditEvent, type AuditEvent } from "@/lib/auth/audit";

afterEach(() => {
  rpcMock.mockReset();
  getServiceMock.mockClear();
});

describe("writeAuditEvent (W3.G3.T1, FR-AUTH-7)", () => {
  it("calls append_audit RPC with the event payload wrapped as p_event", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const event: AuditEvent = {
      actor_user_id: "00000000-0000-0000-0000-000000000001",
      actor_session_id: "00000000-0000-0000-0000-000000000002",
      acting_as_tenant_id: "00000000-0000-0000-0000-000000000003",
      acting_as_role: "editor",
      action: "site.publish",
      resource_type: "site",
      resource_id: "site-123",
      ip: "203.0.113.1",
      user_agent: "Mozilla/5.0",
      request_id: "req-abc",
      metadata: { source: "test" },
    };

    await writeAuditEvent(event);

    expect(getServiceMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledOnce();
    const [fnName, args] = rpcMock.mock.calls[0];
    expect(fnName).toBe("append_audit");
    expect(args).toEqual({ p_event: event });
  });

  it("only requires `action` — other fields default to omitted/undefined", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await writeAuditEvent({ action: "auth.login" });
    expect(rpcMock).toHaveBeenCalledWith("append_audit", {
      p_event: { action: "auth.login" },
    });
  });

  it("throws when Supabase returns an error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    await expect(writeAuditEvent({ action: "x" })).rejects.toThrow(
      /audit_log write failed: permission denied/,
    );
  });

  it("throws when the RPC call itself rejects (network/timeout)", async () => {
    rpcMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(writeAuditEvent({ action: "x" })).rejects.toThrow(
      /ECONNRESET/,
    );
  });

  it("rejects empty/missing action field at compile and runtime", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    // @ts-expect-error — action is required
    await expect(writeAuditEvent({})).rejects.toThrow(/action is required/);
  });

  it("returns void on success (no value)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await writeAuditEvent({ action: "auth.logout" });
    expect(result).toBeUndefined();
  });
});
