import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { TENANT_ID } from "../../helpers/supabase-mocks";

// ── Supabase service mock ─────────────────────────────────────────────────────
const insertMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

// Import AFTER mocks are registered
const { POST } = await import("@/app/api/leads/route");

// ── helpers ───────────────────────────────────────────────────────────────────
function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(body: Record<string, string>): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) fd.append(k, v);
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    body: fd,
  });
}

const validPayload = {
  tenant_id: TENANT_ID,
  name: "Maria López",
  email: "maria@example.com",
  phone: "+5491199887766",
  message: "Hola, quiero info",
};

describe("POST /api/leads", () => {
  beforeEach(() => {
    insertMock.mockResolvedValue({ error: null });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  it("returns {ok:true} for valid JSON lead", async () => {
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("calls Supabase insert with correct shape", async () => {
    await POST(jsonRequest(validPayload));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        name: "Maria López",
        email: "maria@example.com",
      }),
    );
  });

  it("accepts lead with only required fields (name + tenant_id)", async () => {
    const res = await POST(
      jsonRequest({ tenant_id: TENANT_ID, name: "Solo Nombre" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("stores null for empty optional email string", async () => {
    await POST(jsonRequest({ ...validPayload, email: "" }));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: null }),
    );
  });

  it("stores null for missing phone", async () => {
    const { phone: _p, ...noPhone } = validPayload;
    await POST(jsonRequest(noPhone));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null }),
    );
  });

  // ── Validation: 400s ────────────────────────────────────────────────────────
  it("returns 400 when tenant_id is missing", async () => {
    const { tenant_id: _t, ...noTenant } = validPayload;
    const res = await POST(jsonRequest(noTenant));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors).toBeDefined();
  });

  it("returns 400 when tenant_id is not a UUID", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, tenant_id: "not-uuid" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const res = await POST(jsonRequest({ ...validPayload, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 100 chars", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, name: "A".repeat(101) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is malformed (not empty, not valid)", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, email: "notanemail" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone exceeds 50 chars", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, phone: "1".repeat(51) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when message exceeds 2000 chars", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, message: "x".repeat(2001) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty object", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  // ── DB error: 500 ───────────────────────────────────────────────────────────
  it("returns 500 when Supabase insert returns an error", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "db boom" } });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // Must NOT leak internal error message
    expect(JSON.stringify(body)).not.toContain("db boom");
  });

  // ── Form submission redirect ────────────────────────────────────────────────
  it("redirects (303) when submitted as form data", async () => {
    const res = await POST(
      formRequest({
        tenant_id: TENANT_ID,
        name: "Form User",
        email: "form@example.com",
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("lead=ok");
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  it("accepts message with special characters and Unicode", async () => {
    const res = await POST(
      jsonRequest({
        ...validPayload,
        message: "Hola 👋 <script>alert(1)</script>",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts name with accented characters", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, name: "María José Ñúñez" }),
    );
    expect(res.status).toBe(200);
  });
});
