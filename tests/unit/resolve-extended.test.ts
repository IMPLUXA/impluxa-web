import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase service mock with controllable maybeSingle ────────────────────────
const maybySingleMock = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybySingleMock }),
      }),
    }),
  }),
}));

const { resolveTenantBySlug, resolveTenantByDomain, __resetCache } =
  await import("@/lib/tenants/resolve");

const TENANT = {
  id: "t1",
  slug: "hakunamatata",
  name: "Hakuna Matata",
  status: "published",
  template_key: "eventos",
  custom_domain: "hakunamatata.com",
  trial_ends_at: null,
  created_by: null,
  created_at: "2026-05-11T00:00:00Z",
  updated_at: "2026-05-11T00:00:00Z",
};

describe("resolveTenantBySlug — extended", () => {
  beforeEach(() => {
    __resetCache();
    maybySingleMock.mockClear();
    maybySingleMock.mockResolvedValue({ data: TENANT, error: null });
  });

  it("returns null for slug that DB returns null", async () => {
    maybySingleMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await resolveTenantBySlug("not-found");
    expect(result).toBeNull();
  });

  it("caches null result for missing tenants (prevents DB hammering)", async () => {
    maybySingleMock.mockResolvedValue({ data: null, error: null });
    await resolveTenantBySlug("missing-slug");
    await resolveTenantBySlug("missing-slug");
    // Should only call DB once (second call from cache)
    expect(maybySingleMock).toHaveBeenCalledTimes(1);
  });

  it("different slugs get separate cache entries", async () => {
    maybySingleMock.mockResolvedValueOnce({ data: TENANT, error: null });
    maybySingleMock.mockResolvedValueOnce({
      data: { ...TENANT, id: "t2", slug: "other-tenant" },
      error: null,
    });
    const t1 = await resolveTenantBySlug("hakunamatata");
    const t2 = await resolveTenantBySlug("other-tenant");
    expect(t1?.slug).toBe("hakunamatata");
    expect(t2?.slug).toBe("other-tenant");
  });

  it("__resetCache clears all entries (cache miss on next call)", async () => {
    await resolveTenantBySlug("hakunamatata");
    __resetCache();
    maybySingleMock.mockClear();
    await resolveTenantBySlug("hakunamatata");
    expect(maybySingleMock).toHaveBeenCalledOnce();
  });

  it("returns correct tenant shape with all expected fields", async () => {
    const result = await resolveTenantBySlug("hakunamatata");
    expect(result).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      status: expect.any(String),
      template_key: expect.any(String),
    });
  });
});

describe("resolveTenantByDomain", () => {
  beforeEach(() => {
    __resetCache();
    maybySingleMock.mockClear();
    maybySingleMock.mockResolvedValue({ data: TENANT, error: null });
  });

  it("returns tenant for matching custom_domain", async () => {
    const result = await resolveTenantByDomain("hakunamatata.com");
    expect(result?.custom_domain).toBe("hakunamatata.com");
  });

  it("returns null when domain is not found", async () => {
    maybySingleMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await resolveTenantByDomain("unknown.com");
    expect(result).toBeNull();
  });
});
