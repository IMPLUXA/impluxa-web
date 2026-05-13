import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  ADMIN_USER,
  REGULAR_USER,
  TENANT_ID,
} from "../../helpers/supabase-mocks";

// ── Template registry mock ────────────────────────────────────────────────────
const mockTemplate = {
  defaultContent: vi.fn().mockReturnValue({ hero: { title: "Default" } }),
  defaultDesign: vi.fn().mockReturnValue({ colors: {} }),
  defaultMedia: vi.fn().mockReturnValue({ logo: null }),
};
vi.mock("@/templates/registry", () => ({
  getTemplate: vi.fn().mockReturnValue(mockTemplate),
}));

// ── Supabase server client (SSR) mock for auth ────────────────────────────────
const ssrAuthMock = {
  getUser: vi.fn().mockResolvedValue({ data: { user: ADMIN_USER } }),
};
const ssrClientMock = { auth: ssrAuthMock };
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue(ssrClientMock),
}));

// ── Supabase service client mock ──────────────────────────────────────────────
const tenantInsertChain = {
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
};
tenantInsertChain.insert.mockReturnValue(tenantInsertChain);
tenantInsertChain.select.mockReturnValue(tenantInsertChain);
tenantInsertChain.single.mockResolvedValue({
  data: { id: TENANT_ID, slug: "new-tenant", status: "draft" },
  error: null,
});

const siteInsertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
const subInsertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
const memberInsertChain = {
  insert: vi.fn().mockResolvedValue({ error: null }),
};

const svcAuthAdmin = {
  listUsers: vi.fn().mockResolvedValue({
    data: { users: [] },
    error: null,
  }),
  inviteUserByEmail: vi.fn().mockResolvedValue({
    data: { user: { id: "invited-owner-id" } },
    error: null,
  }),
};

let fromCallIndex = 0;
const svcClientMock = {
  from: vi.fn().mockImplementation((table: string) => {
    if (table === "tenants") return tenantInsertChain;
    if (table === "sites") return siteInsertChain;
    if (table === "subscriptions") return subInsertChain;
    if (table === "tenant_members") return memberInsertChain;
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  }),
  auth: { admin: svcAuthAdmin },
};

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue(svcClientMock),
}));

const { POST } = await import("@/app/api/admin/tenants/route");
const { getTemplate } = await import("@/templates/registry");

// ── helpers ───────────────────────────────────────────────────────────────────
function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/tenants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  slug: "mi-evento",
  name: "Mi Evento Corp",
  template_key: "eventos",
  owner_email: "owner@example.com",
};

describe("POST /api/admin/tenants", () => {
  beforeEach(() => {
    fromCallIndex = 0;
    // Clear call counts so tests don't leak into each other
    ssrAuthMock.getUser.mockClear();
    svcAuthAdmin.listUsers.mockClear();
    svcAuthAdmin.inviteUserByEmail.mockClear();
    memberInsertChain.insert.mockClear();
    siteInsertChain.insert.mockClear();
    subInsertChain.insert.mockClear();
    tenantInsertChain.single.mockClear();

    // Reset default return values
    ssrAuthMock.getUser.mockResolvedValue({ data: { user: ADMIN_USER } });
    tenantInsertChain.single.mockResolvedValue({
      data: { id: TENANT_ID, slug: "mi-evento", status: "draft" },
      error: null,
    });
    siteInsertChain.insert.mockResolvedValue({ error: null });
    subInsertChain.insert.mockResolvedValue({ error: null });
    memberInsertChain.insert.mockResolvedValue({ error: null });
    svcAuthAdmin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });
    svcAuthAdmin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "invited-owner-id" } },
      error: null,
    });
    (getTemplate as ReturnType<typeof vi.fn>).mockReturnValue(mockTemplate);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  it("returns {ok:true, slug, tenant_id} for admin user", async () => {
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.slug).toBeDefined();
    expect(body.tenant_id).toBeDefined();
  });

  it("invites owner by email when user does not exist", async () => {
    await POST(jsonRequest(validPayload));
    expect(svcAuthAdmin.inviteUserByEmail).toHaveBeenCalledWith(
      "owner@example.com",
      expect.objectContaining({ redirectTo: expect.any(String) }),
    );
  });

  it("links existing user instead of inviting when found in listUsers", async () => {
    svcAuthAdmin.listUsers.mockResolvedValueOnce({
      data: { users: [{ id: "existing-id", email: "owner@example.com" }] },
      error: null,
    });
    await POST(jsonRequest(validPayload));
    expect(svcAuthAdmin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(memberInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "existing-id", role: "owner" }),
    );
  });

  it("seeds site with template default content", async () => {
    await POST(jsonRequest(validPayload));
    expect(siteInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_json: expect.any(Object),
      }),
    );
  });

  it("creates subscription with plan_key=trial", async () => {
    await POST(jsonRequest(validPayload));
    expect(subInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan_key: "trial", status: "trial" }),
    );
  });

  // ── Auth: 403 for non-admin ─────────────────────────────────────────────────
  it("returns 403 when user is not authenticated", async () => {
    ssrAuthMock.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("forbidden");
  });

  it("returns 403 when user has editor role (not admin)", async () => {
    ssrAuthMock.getUser.mockResolvedValueOnce({ data: { user: REGULAR_USER } });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(403);
  });

  it("returns 403 when user has no role in app_metadata", async () => {
    ssrAuthMock.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-id", app_metadata: {} } },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(403);
  });

  // ── Validation: 400s ────────────────────────────────────────────────────────
  it("returns 400 when slug is missing", async () => {
    const { slug: _s, ...noSlug } = validPayload;
    const res = await POST(jsonRequest(noSlug));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad_request");
  });

  it("returns 400 when slug has invalid characters (uppercase)", async () => {
    const res = await POST(jsonRequest({ ...validPayload, slug: "Mi-Evento" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug is too short (< 3 chars)", async () => {
    const res = await POST(jsonRequest({ ...validPayload, slug: "ab" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug starts with dash", async () => {
    const res = await POST(jsonRequest({ ...validPayload, slug: "-slug" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty", async () => {
    const res = await POST(jsonRequest({ ...validPayload, name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when owner_email is not a valid email", async () => {
    const res = await POST(
      jsonRequest({ ...validPayload, owner_email: "notanemail" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when template_key is unknown", async () => {
    (getTemplate as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const res = await POST(
      jsonRequest({ ...validPayload, template_key: "unknown" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unknown_template");
  });

  it("returns 400 when body is empty", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  // ── DB error paths ──────────────────────────────────────────────────────────
  it("returns 400 when tenant insert fails (e.g. slug duplicate)", async () => {
    tenantInsertChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(400);
  });

  it("returns 500 when site insert fails", async () => {
    siteInsertChain.insert.mockResolvedValueOnce({
      error: { message: "site insert error" },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(500);
  });

  it("returns 500 when subscription insert fails", async () => {
    subInsertChain.insert.mockResolvedValueOnce({
      error: { message: "subscription error" },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(500);
  });

  it("returns 500 when listUsers fails", async () => {
    svcAuthAdmin.listUsers.mockResolvedValueOnce({
      data: null,
      error: { message: "auth admin error" },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(500);
  });

  it("returns 400 when inviteUserByEmail fails", async () => {
    svcAuthAdmin.inviteUserByEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "invite error" },
    });
    const res = await POST(jsonRequest(validPayload));
    expect(res.status).toBe(400);
  });
});
