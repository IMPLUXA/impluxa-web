import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TENANT_ID, REGULAR_USER } from "../../helpers/supabase-mocks";

// ── Supabase server client mock ───────────────────────────────────────────────
const updateChain = {
  update: vi.fn(),
  eq: vi.fn(),
};
// Chain: update().eq() resolves
updateChain.update.mockReturnValue(updateChain);
updateChain.eq.mockResolvedValue({ error: null });

const authMock = {
  getUser: vi.fn().mockResolvedValue({ data: { user: REGULAR_USER } }),
};

const serverClientMock = {
  auth: authMock,
  from: vi.fn().mockReturnValue(updateChain),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue(serverClientMock),
}));

const { POST } = await import("@/app/api/site/content/route");

// ── helpers ───────────────────────────────────────────────────────────────────
function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/site/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  tenant_id: TENANT_ID,
  content_json: { hero: { title: "Mi Evento" }, tagline: "El mejor evento" },
};

describe("POST /api/site/content", () => {
  beforeEach(() => {
    authMock.getUser.mockResolvedValue({ data: { user: REGULAR_USER } });
    updateChain.eq.mockResolvedValue({ error: null });
    updateChain.update.mockReturnValue(updateChain);
    serverClientMock.from.mockReturnValue(updateChain);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  it("returns {ok:true} for authenticated user with valid payload", async () => {
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("calls sites.update with content_json and updated_at", async () => {
    await POST(jsonRequest(validPayload));
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content_json: validPayload.content_json,
        updated_at: expect.any(String),
      }),
    );
  });

  it("calls .eq with correct tenant_id", async () => {
    await POST(jsonRequest(validPayload));
    expect(updateChain.eq).toHaveBeenCalledWith("tenant_id", TENANT_ID);
  });

  it("accepts deeply nested content_json", async () => {
    const res = await POST(
      jsonRequest({
        ...validPayload,
        content_json: { a: { b: { c: [1, 2, 3] } } },
      }),
    );
    expect(res.status).toBe(200);
  });

  // ── Auth: 401 ───────────────────────────────────────────────────────────────
  it("returns 401 when user is not authenticated", async () => {
    authMock.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  // ── Validation: 400s ────────────────────────────────────────────────────────
  it("returns 400 when tenant_id is missing", async () => {
    const res = await POST(jsonRequest({ content_json: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tenant_id is not a UUID", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, tenant_id: "bad-id" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content_json is missing", async () => {
    const res = await POST(jsonRequest({ tenant_id: TENANT_ID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content_json is not a record", async () => {
    const res = await POST(
      jsonRequest({ tenant_id: TENANT_ID, content_json: "string" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  // ── DB error: RLS denial → 403 ──────────────────────────────────────────────
  it("returns 403 when Supabase RLS denies the update", async () => {
    updateChain.eq.mockResolvedValueOnce({
      error: { message: "RLS policy violation" },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
