import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TENANT_ID, REGULAR_USER } from "../../helpers/supabase-mocks";

// ── Cache mock (CRITICAL: FR-1.4 — cache invalidation on publish) ─────────────
const resetCacheMock = vi.fn();
vi.mock("@/lib/tenants/resolve", () => ({
  __resetCache: resetCacheMock,
  resolveTenantBySlug: vi.fn(),
}));

// ── Supabase server client mock ───────────────────────────────────────────────
// Track per-call behavior via a queue approach
let tenantSlugData: { slug: string } | null = { slug: "hakunamatata" };
let updateError: { message: string } | null = null;
let sitesError: { message: string } | null = null;

const authMock = {
  getUser: vi.fn().mockResolvedValue({ data: { user: REGULAR_USER } }),
};

// Each from("tenants") call needs to support either update().eq() or select().eq().single()
// We use a counter to distinguish calls
let tenantFromCallCount = 0;

function makeTenantsChain() {
  tenantFromCallCount++;
  const callNum = tenantFromCallCount;
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: updateError }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: tenantSlugData,
          error: null,
        }),
      }),
    }),
  };
}

function makeSitesChain() {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: sitesError }),
    }),
  };
}

const serverClientMock = {
  auth: authMock,
  from: vi.fn().mockImplementation((table: string) => {
    if (table === "sites") return makeSitesChain();
    return makeTenantsChain();
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue(serverClientMock),
}));

const { POST } = await import("@/app/api/site/publish/route");

// ── helpers ───────────────────────────────────────────────────────────────────
function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/site/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = { tenant_id: TENANT_ID };

describe("POST /api/site/publish", () => {
  beforeEach(() => {
    tenantFromCallCount = 0;
    tenantSlugData = { slug: "hakunamatata" };
    updateError = null;
    sitesError = null;
    resetCacheMock.mockClear();
    authMock.getUser.mockResolvedValue({ data: { user: REGULAR_USER } });
    serverClientMock.from.mockImplementation((table: string) => {
      if (table === "sites") return makeSitesChain();
      return makeTenantsChain();
    });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  it("returns {ok:true, published_at} for authenticated user", async () => {
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ── CRITICAL: FR-1.4 cache invalidation ────────────────────────────────────
  it("calls __resetCache with tenant slug after publish (FR-1.4)", async () => {
    await POST(jsonRequest(validPayload));
    expect(resetCacheMock).toHaveBeenCalledOnce();
    expect(resetCacheMock).toHaveBeenCalledWith("hakunamatata");
  });

  it("calls __resetCache even when different slug is returned", async () => {
    tenantSlugData = { slug: "another-slug" };
    await POST(jsonRequest(validPayload));
    expect(resetCacheMock).toHaveBeenCalledWith("another-slug");
  });

  it("calls __resetCache with undefined when tenant slug not found", async () => {
    tenantSlugData = null;
    await POST(jsonRequest(validPayload));
    // __resetCache(undefined) — clears all cache
    expect(resetCacheMock).toHaveBeenCalledOnce();
    expect(resetCacheMock).toHaveBeenCalledWith(undefined);
  });

  // ── Auth: 401 ───────────────────────────────────────────────────────────────
  it("returns 401 when user is not authenticated", async () => {
    authMock.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("does NOT call __resetCache when user is not authenticated", async () => {
    authMock.getUser.mockResolvedValueOnce({ data: { user: null } });
    await POST(jsonRequest(validPayload));
    expect(resetCacheMock).not.toHaveBeenCalled();
  });

  // ── Validation: 400s ────────────────────────────────────────────────────────
  it("returns 400 when tenant_id is missing", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tenant_id is not a UUID", async () => {
    const res = await POST(jsonRequest({ tenant_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("does NOT call __resetCache on validation error", async () => {
    await POST(jsonRequest({}));
    expect(resetCacheMock).not.toHaveBeenCalled();
  });

  // ── DB error: 403 ───────────────────────────────────────────────────────────
  it("returns 403 when tenants update fails", async () => {
    updateError = { message: "RLS denied" };
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 403 when sites update fails", async () => {
    sitesError = { message: "sites RLS" };
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(403);
  });

  it("does NOT call __resetCache when tenants update fails", async () => {
    updateError = { message: "db error" };
    await POST(jsonRequest(validPayload));
    expect(resetCacheMock).not.toHaveBeenCalled();
  });

  it("does NOT call __resetCache when sites update fails", async () => {
    sitesError = { message: "sites error" };
    await POST(jsonRequest(validPayload));
    expect(resetCacheMock).not.toHaveBeenCalled();
  });
});
