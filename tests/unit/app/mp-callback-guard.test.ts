import { describe, it, expect, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// Guard SIGNAL-14 del callback OAuth: en preview/dev NO debe escribir tokens a prod
// (es la ruta que mas muto prod desde un preview en s55). El guard retorna ANTES de
// tocar cookie/exchange/upsert -> en el caso preview los mocks no se invocan. Caso
// prod/local (VERCEL_ENV ausente): el guard NO dispara y sigue el flujo normal (sin
// cookie -> rechazo + redirect, NO 403).
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, delete: () => {} }),
  headers: async () => ({ get: () => "app.placeholder.local" }),
}));
vi.mock("@/lib/mp/oauth", () => ({
  verifyState: async () => ({}),
  exchangeCodeForTokens: async () => ({}),
  MP_OAUTH_STATE_COOKIE: "mp_oauth_state",
}));
vi.mock("@/lib/mp/credentials", () => ({
  upsertMpCredentials: async () => {},
}));
vi.mock("@/lib/auth/guard", () => ({
  requireActiveTenantOrResponse: async () => ({ ok: false }),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ rpc: async () => ({ data: null }) }),
}));

import { GET } from "@/app/api/mp/oauth/callback/route";

function req(): NextRequest {
  return {
    url: "https://impluxa-web-git-feat-mp-arco-s55.vercel.app/api/mp/oauth/callback",
  } as unknown as NextRequest;
}

describe("GET /api/mp/oauth/callback — guard preview (SIGNAL 14)", () => {
  afterEach(() => {
    delete process.env.VERCEL_ENV;
  });

  it("VERCEL_ENV=preview -> 403 E_NON_PROD (no escribe tokens a prod)", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("E_NON_PROD");
  });

  it("VERCEL_ENV ausente (prod/local) -> guard NO dispara (no 403)", async () => {
    const res = await GET(req());
    expect(res.status).not.toBe(403);
  });
});
