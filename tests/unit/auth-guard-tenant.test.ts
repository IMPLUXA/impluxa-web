import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { REGULAR_USER, TENANT_ID } from "../helpers/supabase-mocks";

// ── next/navigation mock ──────────────────────────────────────────────────────
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

// ── next/server mock (avoid edge-runtime imports under jsdom) ─────────────────
const nextResponseJsonMock = vi.fn(
  (body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200,
    body,
    _isMockNextResponse: true as const,
  }),
);
vi.mock("next/server", () => ({
  NextResponse: { json: nextResponseJsonMock },
}));

// ── Supabase server client mock (auth.getUser + auth.getSession) ──────────────
const getUserMock = vi.fn();
const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock, getSession: getSessionMock },
  }),
}));

// ── Supabase service client mock (append_audit RPC) ───────────────────────────
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: vi.fn(() => ({ rpc: rpcMock })),
}));

const { requireActiveTenantOrRedirect, requireActiveTenantOrResponse } =
  await import("@/lib/auth/guard");

// ── JWT helpers (decodeJwt only parses public payload, no signature check) ────
function base64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function makeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

const TEST_JTI = "jti-abc-123";
const TOKEN_WITH_JTI = makeJwt({ jti: TEST_JTI, sub: "user-uuid" });
const TOKEN_NO_JTI = makeJwt({ sub: "user-uuid" });
const MALFORMED_TOKEN = "not.a.jwt";

// ── User fixtures ─────────────────────────────────────────────────────────────
const USER_WITH_TENANT = {
  ...REGULAR_USER,
  app_metadata: { role: "editor", active_tenant_id: TENANT_ID },
};
// REGULAR_USER has app_metadata: { role: "editor" } — no active_tenant_id key
const USER_CLAIM_MISSING = REGULAR_USER;
const USER_TENANT_NULL = {
  ...REGULAR_USER,
  app_metadata: { role: "editor", active_tenant_id: null },
};
const USER_TENANT_EMPTY = {
  ...REGULAR_USER,
  app_metadata: { role: "editor", active_tenant_id: "" },
};
const USER_TENANT_NONSTRING = {
  ...REGULAR_USER,
  app_metadata: { role: "editor", active_tenant_id: 42 },
};

function resetAllMocks() {
  redirectMock.mockClear();
  redirectMock.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  nextResponseJsonMock.mockClear();
  getUserMock.mockReset();
  getSessionMock.mockReset();
  rpcMock.mockReset();
}

// ════════════════════════════════════════════════════════════════════════════════
// Group A — requireActiveTenantOrRedirect (Pages / Server Components)
// ════════════════════════════════════════════════════════════════════════════════
describe("requireActiveTenantOrRedirect (W1.T1 paso 5)", () => {
  beforeEach(resetAllMocks);

  // A1 — happy path
  it("A1: returns {user,tenantId} when active_tenant_id is valid", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_WITH_TENANT } });

    const result = await requireActiveTenantOrRedirect();

    expect(result).toEqual({ user: USER_WITH_TENANT, tenantId: TENANT_ID });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  // A2 — claim_missing + INVARIANTE orden rpc-pre-redirect
  it("A2: claim_missing → emits audit then redirects (rpc BEFORE redirect)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_WITH_JTI } },
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/login?e=e07",
    );

    // Invariante: emit (rpc) completed BEFORE redirect threw
    expect(rpcMock).toHaveBeenCalledWith("append_audit", {
      p_event: {
        action: "claim_missing",
        jwt_jti: TEST_JTI,
        actor_user_id: USER_CLAIM_MISSING.id,
      },
    });
    expect(redirectMock).toHaveBeenCalledWith("/login?e=e07");
    const rpcOrder = rpcMock.mock.invocationCallOrder[0];
    const redirectOrder = redirectMock.mock.invocationCallOrder[0];
    expect(rpcOrder).toBeLessThan(redirectOrder);
  });

  // A3 — active_tenant_null (3 sub-cases) + INVARIANTE
  it.each([
    ["null", USER_TENANT_NULL],
    ["empty string", USER_TENANT_EMPTY],
    ["non-string (number)", USER_TENANT_NONSTRING],
  ])(
    "A3: active_tenant_null (%s) → emits audit then redirects (rpc BEFORE redirect)",
    async (_label, user) => {
      getUserMock.mockResolvedValueOnce({ data: { user } });
      getSessionMock.mockResolvedValueOnce({
        data: { session: { access_token: TOKEN_WITH_JTI } },
      });
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
        "NEXT_REDIRECT:/login?e=e07",
      );

      expect(rpcMock).toHaveBeenCalledWith("append_audit", {
        p_event: {
          action: "active_tenant_null",
          jwt_jti: TEST_JTI,
          actor_user_id: user.id,
        },
      });
      expect(redirectMock).toHaveBeenCalledWith("/login?e=e07");
      const rpcOrder = rpcMock.mock.invocationCallOrder[0];
      const redirectOrder = redirectMock.mock.invocationCallOrder[0];
      expect(rpcOrder).toBeLessThan(redirectOrder);
    },
  );

  // A4 — no-jti fallback (session ausente o access_token sin jti)
  it("A4: no session → emits with jwt_jti undefined (rpc BEFORE redirect)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/login?e=e07",
    );

    expect(rpcMock).toHaveBeenCalledWith("append_audit", {
      p_event: {
        action: "claim_missing",
        actor_user_id: USER_CLAIM_MISSING.id,
        // jwt_jti omitted because undefined (writeAuditEvent forwards full event)
        jwt_jti: undefined,
      },
    });
    const rpcOrder = rpcMock.mock.invocationCallOrder[0];
    const redirectOrder = redirectMock.mock.invocationCallOrder[0];
    expect(rpcOrder).toBeLessThan(redirectOrder);
  });

  it("A4b: access_token present but no jti claim → emits with jwt_jti undefined", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_NO_JTI } },
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/login?e=e07",
    );

    const callArgs = rpcMock.mock.calls[0][1] as {
      p_event: { jwt_jti?: string };
    };
    expect(callArgs.p_event.jwt_jti).toBeUndefined();
  });

  // A5 — unauthenticated (delegates to requireUser → redirect /login, no emit)
  it("A5: unauthenticated → redirects /login WITHOUT emitting audit", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  // A6 — malformed JWT in extractJti → returns undefined (no 500)
  it("A6: malformed JWT in access_token → emits with jwt_jti undefined (no 500)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: MALFORMED_TOKEN } },
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    // Must throw NEXT_REDIRECT, NOT a JWT parse error
    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/login?e=e07",
    );

    expect(rpcMock).toHaveBeenCalledOnce();
    const callArgs = rpcMock.mock.calls[0][1] as {
      p_event: { jwt_jti?: string };
    };
    expect(callArgs.p_event.jwt_jti).toBeUndefined();
    expect(redirectMock).toHaveBeenCalledWith("/login?e=e07");
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Group B — requireActiveTenantOrResponse (API Route Handlers)
// ════════════════════════════════════════════════════════════════════════════════
describe("requireActiveTenantOrResponse (W1.T1 paso 5)", () => {
  beforeEach(resetAllMocks);

  // B1 — happy
  it("B1: returns {ok:true,user,tenantId} when active_tenant_id is valid", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_WITH_TENANT } });

    const result = await requireActiveTenantOrResponse();

    expect(result).toEqual({
      ok: true,
      user: USER_WITH_TENANT,
      tenantId: TENANT_ID,
    });
    expect(nextResponseJsonMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // B2 — 401 unauthenticated
  it("B2: unauthenticated → 401 {error:'unauthorized',code:'E_AUTH'}", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const result = await requireActiveTenantOrResponse();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false branch");
    expect(result.response.status).toBe(401);
    expect(result.response.body).toEqual({
      error: "unauthorized",
      code: "E_AUTH",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  // B3 — 403 claim_missing
  it("B3: claim_missing → 403 {error:'forbidden',code:'E_TENANT_CLAIM'} (rpc BEFORE response)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_WITH_JTI } },
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await requireActiveTenantOrResponse();

    if (result.ok) throw new Error("expected ok:false branch");
    expect(result.response.status).toBe(403);
    expect(result.response.body).toEqual({
      error: "forbidden",
      code: "E_TENANT_CLAIM",
    });
    expect(rpcMock).toHaveBeenCalledWith("append_audit", {
      p_event: {
        action: "claim_missing",
        jwt_jti: TEST_JTI,
        actor_user_id: USER_CLAIM_MISSING.id,
      },
    });
    const rpcOrder = rpcMock.mock.invocationCallOrder[0];
    const respOrder = nextResponseJsonMock.mock.invocationCallOrder[0];
    expect(rpcOrder).toBeLessThan(respOrder);
  });

  // B4 — 403 active_tenant_null
  it("B4: active_tenant_null → 403 {error:'forbidden',code:'E_TENANT_CLAIM'}", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_TENANT_NULL } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_WITH_JTI } },
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await requireActiveTenantOrResponse();

    if (result.ok) throw new Error("expected ok:false branch");
    expect(result.response.status).toBe(403);
    expect(result.response.body).toEqual({
      error: "forbidden",
      code: "E_TENANT_CLAIM",
    });
    expect(rpcMock).toHaveBeenCalledWith("append_audit", {
      p_event: {
        action: "active_tenant_null",
        jwt_jti: TEST_JTI,
        actor_user_id: USER_TENANT_NULL.id,
      },
    });
  });

  // B5 — body shape strict (no PII, exact keys)
  it("B5: response body shape is strict {error,code} only, no PII", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_WITH_JTI } },
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await requireActiveTenantOrResponse();

    if (result.ok) throw new Error("expected ok:false branch");
    const bodyKeys = Object.keys(result.response.body as object).sort();
    expect(bodyKeys).toEqual(["code", "error"]);
    // Assert no PII leaked into body
    expect(JSON.stringify(result.response.body)).not.toContain(
      USER_CLAIM_MISSING.id,
    );
    expect(JSON.stringify(result.response.body)).not.toContain(TEST_JTI);
    expect(JSON.stringify(result.response.body)).not.toContain(
      USER_CLAIM_MISSING.email,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Group C — emit helper (tested via guard entrypoint; helper not exported)
// ════════════════════════════════════════════════════════════════════════════════
describe("emitTenantClaimAudit (via guard entrypoint)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // C1 — dedup race simulated (RPC returns null/null, ON CONFLICT DO NOTHING)
  it("C1: dedup race (rpc returns data:null,error:null) → emit no-throws, redirect proceeds", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_WITH_JTI } },
    });
    // Simulate dedup hit: PK violation swallowed by ON CONFLICT DO NOTHING
    // RPC returns no rows but no error either
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/login?e=e07",
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login?e=e07");
  });

  // C2 — structured log pre-throw on RPC failure
  it("C2: rpc error → console.error structured JSON + re-throws (redirect NOT reached)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: USER_CLAIM_MISSING } });
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: TOKEN_WITH_JTI } },
    });
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    await expect(requireActiveTenantOrRedirect()).rejects.toThrow(
      /audit_log write failed: permission denied/,
    );

    // redirect must NOT have been called — emit re-threw
    expect(redirectMock).not.toHaveBeenCalled();

    // console.error called once with structured JSON
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const loggedArg = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(loggedArg);
    expect(parsed).toMatchObject({
      level: "error",
      event: "audit_write_failed",
      reason: "claim_missing",
      user_id: USER_CLAIM_MISSING.id,
      has_jti: true,
    });
    expect(typeof parsed.err).toBe("string");
    expect(parsed.err).toMatch(/permission denied/);
  });
});
