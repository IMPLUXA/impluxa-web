export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  generatePkce,
  generateState,
  buildAuthorizeUrl,
  signState,
  MP_OAUTH_STATE_COOKIE,
} from "@/lib/mp/oauth";

// GET /api/mp/oauth/authorize — inicia el OAuth-connect del tenant con MercadoPago.
// Solo dueño/encargado puede conectar (un vendedor NO debe enlazar/pisar la cuenta MP).
// Setea cookie httpOnly firmada con {state, verifier, tenant, user} y redirige a MP.
// SCAFFOLD: requiere F0 (MP_CLIENT_ID / redirect / firma del state en env). Sin esos
// env, signState/buildAuthorizeUrl fallan fail-closed (500), por diseño.
export async function GET() {
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return guard.response;

  // Gate de rol: la autoridad es la RPC current_agency_role() (cliente autenticado).
  const sb = await getSupabaseServerClient();
  const { data: role } = await sb.rpc("current_agency_role");
  if (role !== "dueno_admin" && role !== "encargado") {
    return NextResponse.json(
      { error: "forbidden", code: "E_ROLE" },
      { status: 403 },
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const cookie = await signState({
    state,
    verifier,
    tenantId: guard.tenantId,
    userId: guard.user.id,
  });

  const store = await cookies();
  store.set(MP_OAUTH_STATE_COOKIE, cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10m — alineado con la validez del code de MP
  });

  return NextResponse.redirect(
    buildAuthorizeUrl({ state, codeChallenge: challenge }),
  );
}
