import { describe, expect, it, vi, beforeEach } from "vitest";

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => holder.client,
}));

import { insertMpWebhookDeadLetter } from "@/lib/mp/dead-letter";

function makeClient(insertResult: { error: { message: string } | null }) {
  const insert = vi.fn(async () => insertResult);
  return { client: { from: vi.fn(() => ({ insert })) }, insert };
}

describe("insertMpWebhookDeadLetter", () => {
  beforeEach(() => {
    holder.client = null;
  });

  it("insert OK → true", async () => {
    const m = makeClient({ error: null });
    holder.client = m.client;
    const ok = await insertMpWebhookDeadLetter({
      dataId: "999",
      xRequestId: "req-1",
      topic: "payment",
      reason: "token_unauthorized",
      tenantId: "t-1",
      mpUserId: "182102575",
      paymentStatus: "approved",
      notifExcerpt: { topic: "payment", data_id: "999", user_id: "182102575" },
    });
    expect(ok).toBe(true);
    expect(m.insert).toHaveBeenCalledOnce();
    const arg = (m.insert.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    // allowlist: NO debe haber token ni PII en el insert
    expect(arg).not.toHaveProperty("access_token");
    expect(arg.reason).toBe("token_unauthorized");
  });

  it("insert con error de DB → false (no tira)", async () => {
    const m = makeClient({ error: { message: "rls denied" } });
    holder.client = m.client;
    const ok = await insertMpWebhookDeadLetter({
      dataId: "1",
      xRequestId: null,
      topic: "payment",
      reason: "payment_not_found",
    });
    expect(ok).toBe(false);
  });

  it("excepción inesperada → false (no tira)", async () => {
    holder.client = {
      from: () => {
        throw new Error("conn down");
      },
    };
    const ok = await insertMpWebhookDeadLetter({
      dataId: "1",
      xRequestId: null,
      topic: "payment",
      reason: "x",
    });
    expect(ok).toBe(false);
  });
});
