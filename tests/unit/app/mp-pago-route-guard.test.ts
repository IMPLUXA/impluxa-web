import { describe, it, expect, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// Guard SIGNAL-14 de la ruta F3 iniciar-pago (pago-mp): crea fila pagos pendiente en
// prod + llama a la API de MP con el token del vendedor. En preview/dev NO debe mutar.
// El guard retorna ANTES del guard de sesion / RPC / POST a MP -> en el caso preview
// los mocks no se invocan. Caso ausente: el guard NO dispara y sigue el flujo (con
// requireActiveTenantOrResponse mockeado ok:false -> 401, NO 403 E_NON_PROD).
vi.mock("@/lib/auth/guard", () => ({
  requireActiveTenantOrResponse: async () => ({
    ok: false,
    response: new Response(null, { status: 401 }),
  }),
}));
vi.mock("@/lib/agency/role", () => ({
  getAgencyRole: async () => "dueno_admin",
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({}),
}));
vi.mock("@/lib/agency/pago-mp", () => ({
  IniciarPagoMpSchema: {
    safeParse: () => ({ success: false, error: { flatten: () => ({}) } }),
  },
  buildIniciarPagoMpArgs: () => ({}),
}));
vi.mock("@/lib/agency/route-helpers", () => ({
  badRequest: () => new Response(null, { status: 400 }),
}));
vi.mock("@/lib/mp/credentials", () => ({ getMpAccessToken: async () => null }));
vi.mock("@/lib/mp/preference", () => ({
  buildCheckoutProPreferenceBody: () => ({}),
}));
vi.mock("@/lib/mp/preference-api", () => ({
  createCheckoutProPreference: async () => ({}),
}));

import { POST } from "@/app/api/agency/reservas/[id]/pago-mp/route";

function req(): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => ({}),
  } as unknown as NextRequest;
}
const ctx = () => ({ params: Promise.resolve({ id: "r-1" }) });

describe("POST /api/agency/reservas/[id]/pago-mp — guard preview (SIGNAL 14)", () => {
  afterEach(() => {
    delete process.env.VERCEL_ENV;
  });

  it("VERCEL_ENV=preview -> 403 E_NON_PROD (no crea pago ni llama a MP)", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await POST(req(), ctx());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("E_NON_PROD");
  });

  it("VERCEL_ENV ausente (prod/local) -> guard NO dispara (no 403 E_NON_PROD)", async () => {
    const res = await POST(req(), ctx());
    expect(res.status).not.toBe(403); // guard de sesion ok:false -> 401
  });
});
