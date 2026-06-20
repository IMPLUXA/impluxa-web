import { describe, expect, it, vi, beforeEach } from "vitest";

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => holder.client,
}));

import { getTenantByMpUserId } from "@/lib/mp/credentials";

function makeClient(maybeSingleResult: {
  data: unknown;
  error: { message: string } | null;
}) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => maybeSingleResult);
  return { from: vi.fn(() => builder) };
}

describe("getTenantByMpUserId", () => {
  beforeEach(() => {
    holder.client = null;
  });

  it("hit → {tenantId, mpUserId}", async () => {
    holder.client = makeClient({
      data: { tenant_id: "t-1", mp_user_id: "182102575" },
      error: null,
    });
    const r = await getTenantByMpUserId("182102575");
    expect(r).toEqual({ tenantId: "t-1", mpUserId: "182102575" });
  });

  it("miss (data null) → null", async () => {
    holder.client = makeClient({ data: null, error: null });
    expect(await getTenantByMpUserId("000")).toBeNull();
  });

  it("mpUserId vacío → null sin tocar DB", async () => {
    holder.client = makeClient({ data: null, error: null });
    expect(await getTenantByMpUserId("")).toBeNull();
    expect(await getTenantByMpUserId("   ")).toBeNull();
  });

  it("error de DB → throw", async () => {
    holder.client = makeClient({ data: null, error: { message: "boom" } });
    await expect(getTenantByMpUserId("1")).rejects.toThrow(
      /getTenantByMpUserId/,
    );
  });
});
