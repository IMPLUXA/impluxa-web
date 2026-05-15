import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The route now uses `createServerClient` from `@supabase/ssr` DIRECTLY
// (not the shared helper) so it can attach session cookies to the outgoing
// NextResponse explicitly — see route.ts header comment for rationale.
// Tests must mock the direct import, not `@/lib/supabase/server`.
const { exchangeCodeMock, createServerClientMock } = vi.hoisted(() => ({
  exchangeCodeMock: vi.fn().mockResolvedValue({ data: {}, error: null }),
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

createServerClientMock.mockImplementation(() => ({
  auth: { exchangeCodeForSession: exchangeCodeMock },
}));

// Stub env vars the route reads at module load / handler call.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://test.supabase";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key-test";

const { GET } = await import("@/app/api/auth/callback/route");

function makeRequest(code?: string, next?: string): NextRequest {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (next) params.set("next", next);
  const qs = params.toString();
  const url = qs
    ? `http://localhost/api/auth/callback?${qs}`
    : "http://localhost/api/auth/callback";
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    exchangeCodeMock.mockReset().mockResolvedValue({ data: {}, error: null });
    createServerClientMock.mockClear();
  });

  it("redirects to origin root after successful exchange (default `next`)", async () => {
    const res = await GET(makeRequest("valid-code-123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects to the `next` query param when provided", async () => {
    const res = await GET(makeRequest("valid-code-123", "/app/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/app/dashboard");
  });

  it("calls exchangeCodeForSession with the code from query param", async () => {
    await GET(makeRequest("my-auth-code"));
    expect(exchangeCodeMock).toHaveBeenCalledWith("my-auth-code");
  });

  it("redirects to /login?error=missing_code when no code param is present", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?error=missing_code",
    );
  });

  it("does NOT call exchangeCodeForSession when code is absent", async () => {
    await GET(makeRequest());
    expect(exchangeCodeMock).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=... when exchange returns an error", async () => {
    exchangeCodeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "invalid grant" },
    });
    const res = await GET(makeRequest("bad-code"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login?error=");
    expect(location).toContain("invalid%20grant");
  });

  it("does NOT leak auth code in redirect URL", async () => {
    const res = await GET(makeRequest("secret-code"));
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("secret-code");
    expect(location).not.toContain("code=");
  });
});
