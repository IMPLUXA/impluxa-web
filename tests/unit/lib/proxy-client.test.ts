import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest, NextResponse } from "next/server";

const { createServerClientMock, getClaimsMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getClaimsMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { updateSession } from "@/lib/supabase/proxy-client";

beforeEach(() => {
  createServerClientMock.mockReset();
  getClaimsMock
    .mockReset()
    .mockResolvedValue({ data: { claims: {} }, error: null });
  createServerClientMock.mockImplementation((_url, _key, cfg) => ({
    auth: { getClaims: getClaimsMock },
    __cookies: cfg.cookies,
  }));
});

function mkReq(cookies: Array<{ name: string; value: string }>) {
  return {
    cookies: {
      getAll: () => cookies,
    },
  } as unknown as NextRequest;
}

function mkRes() {
  const setCalls: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];
  const res = {
    cookies: {
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        setCalls.push({ name, value, options });
      },
    },
  } as unknown as NextResponse;
  return { res, setCalls };
}

describe("updateSession (W3.G7.T3, FR-AUTH-2)", () => {
  it("creates supabase client with NEXT_PUBLIC_SUPABASE_URL + ANON_KEY", async () => {
    const { res } = mkRes();
    await updateSession(mkReq([]), res, "auth");
    expect(createServerClientMock).toHaveBeenCalledOnce();
    const [url, key] = createServerClientMock.mock.calls[0];
    expect(url).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
    expect(key).toBe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  });

  it("invokes auth.getClaims to refresh session", async () => {
    const { res } = mkRes();
    await updateSession(mkReq([]), res, "app");
    expect(getClaimsMock).toHaveBeenCalledOnce();
  });

  it("getAll() returns incoming request cookies", async () => {
    const reqCookies = [
      { name: "sb-access-token", value: "a" },
      { name: "sb-refresh-token", value: "r" },
    ];
    const { res } = mkRes();
    await updateSession(mkReq(reqCookies), res, "auth");
    const cfg = createServerClientMock.mock.calls[0][2];
    expect(cfg.cookies.getAll()).toEqual(reqCookies);
  });

  it("setAll() NEVER passes `domain` in cookie options (host-only)", async () => {
    const { res, setCalls } = mkRes();
    await updateSession(mkReq([]), res, "auth");
    const cfg = createServerClientMock.mock.calls[0][2];

    // Simulate Supabase asking the adapter to set cookies with a `domain`
    // option present — the adapter MUST drop it before forwarding to res.
    cfg.cookies.setAll([
      {
        name: "sb-access-token",
        value: "new",
        options: { domain: ".impluxa.com", path: "/", httpOnly: true },
      },
      {
        name: "sb-refresh-token",
        value: "newr",
        options: { domain: "auth.impluxa.com", maxAge: 3600 },
      },
    ]);

    expect(setCalls).toHaveLength(2);
    for (const call of setCalls) {
      expect(call.options).toBeDefined();
      expect(call.options).not.toHaveProperty("domain");
      // sanity: other options preserved
    }
    expect(setCalls[0].options?.path).toBe("/");
    expect(setCalls[0].options?.httpOnly).toBe(true);
    expect(setCalls[1].options?.maxAge).toBe(3600);
  });

  it("setAll() accepts options=undefined without crashing", async () => {
    const { res, setCalls } = mkRes();
    await updateSession(mkReq([]), res, "admin");
    const cfg = createServerClientMock.mock.calls[0][2];

    cfg.cookies.setAll([{ name: "x", value: "y" }]);
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].options).toBeUndefined();
  });

  it("hostScope is preserved as parameter even though it does not change cookies yet", async () => {
    // Pre-existing pattern: hostScope is reserved for future per-host cookie name
    // disambiguation (sb-<scope>-* if we ever stop using shared sb-* names).
    // Right now it's a no-op param; this test guards the public API surface.
    const { res } = mkRes();
    await expect(
      updateSession(mkReq([]), res, "auth"),
    ).resolves.toBeUndefined();
    await expect(updateSession(mkReq([]), res, "app")).resolves.toBeUndefined();
    await expect(
      updateSession(mkReq([]), res, "admin"),
    ).resolves.toBeUndefined();
  });
});
