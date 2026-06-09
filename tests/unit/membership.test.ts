import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase service client mock ──────────────────────────────────────────────
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({ from: fromMock }),
}));

const { getUserTenants, getCurrentTenant, getActiveTenant } =
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

describe("getActiveTenant", () => {
  // Mock del chain: from -> select -> eq(user_id) -> eq(tenant_id) -> maybeSingle()
  const maybeSingleMock = vi.fn();
  const eq2Mock = vi.fn();
  const eq1Mock = vi.fn();

  function setupActiveMock(row: { tenant: unknown } | null) {
    maybeSingleMock.mockResolvedValue({ data: row, error: null });
    eq2Mock.mockReturnValue({ maybeSingle: maybeSingleMock });
    eq1Mock.mockReturnValue({ eq: eq2Mock });
    selectMock.mockReturnValue({ eq: eq1Mock });
    fromMock.mockReturnValue({ select: selectMock });
  }

  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    eq1Mock.mockReset();
    eq2Mock.mockReset();
    maybeSingleMock.mockReset();
  });

  it("returns the tenant when the active claim matches a membership", async () => {
    setupActiveMock({ tenant: TENANT_A });
    const result = await getActiveTenant("u1", "aaa");
    expect(result?.slug).toBe("tenant-a");
    expect(fromMock).toHaveBeenCalledWith("tenant_members");
    expect(eq1Mock).toHaveBeenCalledWith("user_id", "u1");
    expect(eq2Mock).toHaveBeenCalledWith("tenant_id", "aaa");
  });

  it("returns null when the active claim is NOT a membership (drift / tamper, fail-closed)", async () => {
    setupActiveMock(null);
    const result = await getActiveTenant("u1", "tampered-tenant-id");
    expect(result).toBeNull();
  });

  it("multi-tenant: returns the ACTIVE tenant, not tenants[0]", async () => {
    // user es member de A y B; active = B (no el primero). Debe devolver B.
    setupActiveMock({ tenant: TENANT_B });
    const result = await getActiveTenant("u1", "bbb");
    expect(result?.slug).toBe("tenant-b");
    expect(eq2Mock).toHaveBeenCalledWith("tenant_id", "bbb");
  });
});
