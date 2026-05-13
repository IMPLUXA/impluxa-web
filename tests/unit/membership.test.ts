import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase service client mock ──────────────────────────────────────────────
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}));

const { getUserTenants, getCurrentTenant } =
  await import("@/lib/tenants/membership");

const TENANT_A = {
  id: "aaa",
  slug: "tenant-a",
  name: "Tenant A",
  template_key: "eventos",
  status: "published",
  custom_domain: null,
  trial_ends_at: null,
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const TENANT_B = {
  ...TENANT_A,
  id: "bbb",
  slug: "tenant-b",
  name: "Tenant B",
};

function setupMock(rows: Array<{ tenant: unknown }>) {
  eqMock.mockResolvedValue({ data: rows, error: null });
  selectMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ select: selectMock });
}

describe("getUserTenants", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
  });

  it("returns list of tenants for a user with memberships", async () => {
    setupMock([{ tenant: TENANT_A }, { tenant: TENANT_B }]);
    const result = await getUserTenants("u1");
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("tenant-a");
    expect(result[1].slug).toBe("tenant-b");
  });

  it("returns empty array when user has no memberships", async () => {
    setupMock([]);
    const result = await getUserTenants("no-member");
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    eqMock.mockResolvedValue({ data: null, error: null });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
    const result = await getUserTenants("u2");
    expect(result).toEqual([]);
  });

  it("filters out null tenant entries", async () => {
    setupMock([{ tenant: TENANT_A }, { tenant: null }]);
    const result = await getUserTenants("u3");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("tenant-a");
  });

  it("queries tenant_members table with correct user_id", async () => {
    setupMock([{ tenant: TENANT_A }]);
    await getUserTenants("specific-user-id");
    expect(fromMock).toHaveBeenCalledWith("tenant_members");
    expect(eqMock).toHaveBeenCalledWith("user_id", "specific-user-id");
  });
});

describe("getCurrentTenant", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
  });

  it("returns first tenant when user has memberships", async () => {
    setupMock([{ tenant: TENANT_A }, { tenant: TENANT_B }]);
    const result = await getCurrentTenant("u1");
    expect(result?.slug).toBe("tenant-a");
  });

  it("returns null when user has no tenants", async () => {
    setupMock([]);
    const result = await getCurrentTenant("no-member");
    expect(result).toBeNull();
  });

  it("returns null when data is null", async () => {
    eqMock.mockResolvedValue({ data: null, error: null });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
    const result = await getCurrentTenant("u2");
    expect(result).toBeNull();
  });
});
