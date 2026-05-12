import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Supabase server client mock ───────────────────────────────────────────────
const exchangeCodeMock = vi.fn().mockResolvedValue({ data: {}, error: null });
const serverClientMock = {
  auth: { exchangeCodeForSession: exchangeCodeMock },
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue(serverClientMock),
}));

const { GET } = await import("@/app/api/auth/callback/route");

// ── helpers ───────────────────────────────────────────────────────────────────
function makeRequest(code?: string): NextRequest {
  const url = code
    ? `http://localhost/api/auth/callback?code=${code}`
    : "http://localhost/api/auth/callback";
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    exchangeCodeMock.mockClear();
  });

  it("redirects to origin root after successful exchange", async () => {
    const res = await GET(makeRequest("valid-code-123"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBe("http://localhost/");
  });

  it("calls exchangeCodeForSession with the code from query param", async () => {
    await GET(makeRequest("my-auth-code"));
    expect(exchangeCodeMock).toHaveBeenCalledWith("my-auth-code");
  });

  it("redirects even when no code param is present", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("does NOT call exchangeCodeForSession when code is absent", async () => {
    await GET(makeRequest());
    expect(exchangeCodeMock).not.toHaveBeenCalled();
  });

  it("does NOT leak auth code in redirect URL", async () => {
    const res = await GET(makeRequest("secret-code"));
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("secret-code");
    expect(location).not.toContain("code=");
  });
});
