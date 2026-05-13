import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitLead } from "@/components/lead-form/lead-form-actions";

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/ratelimit", () => ({ getLeadLimiter: () => null }));
const insertChain = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: "uuid" }, error: null }),
};
vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => ({ from: () => insertChain }),
}));
vi.mock("@/lib/resend", () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => "es-LA" }),
}));

describe("submitLead", () => {
  beforeEach(() => {
    insertChain.insert.mockClear();
  });
  const valid = {
    name: "Marcela",
    email: "marcela@example.com",
    industry: "distribuidora",
    turnstileToken: "tok",
    honeypot: "",
  };
  it("accepts valid lead", async () => {
    const fd = new FormData();
    Object.entries(valid).forEach(([k, v]) => fd.append(k, v));
    const res = await submitLead(fd);
    expect(res.ok).toBe(true);
  });
  it("rejects bad email", async () => {
    const fd = new FormData();
    Object.entries({ ...valid, email: "x" }).forEach(([k, v]) =>
      fd.append(k, v),
    );
    const res = await submitLead(fd);
    expect(res.ok).toBe(false);
  });
  it("rejects when honeypot filled", async () => {
    const fd = new FormData();
    Object.entries({ ...valid, honeypot: "bot" }).forEach(([k, v]) =>
      fd.append(k, v),
    );
    const res = await submitLead(fd);
    expect(res.ok).toBe(false);
  });
});
