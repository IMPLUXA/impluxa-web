export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyState,
  exchangeCodeForTokens,
  MP_OAUTH_STATE_COOKIE,
} from "@/lib/mp/oauth";
import { upsertMpCredentials } from "@/lib/mp/credentials";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/mp/oauth/callback?code=...&state=... — vuelta del consentimiento MP.
// Valida state (cookie firmada single-use) vs el state echo, intercambia el code
// server-to-server (con el PKCE verifier) y persiste los tokens CIFRADOS. Redirige
// al panel con ?mp=connected | ?mp=error (sin filtrar detalle). SCAFFOLD: el exchange
// real necesita F0 (creds en env); sin eso falla fail-closed → ?mp=error.
export async function GET(req: NextRequest) {
  const store = await cookies();
  const cookie = store.get(MP_OAUTH_STATE_COOKIE)?.value;
  // single-use: limpiar la cookie SIEMPRE, pase lo que pase.
  store.delete(MP_OAUTH_STATE_COOKIE);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errBack = NextResponse.redirect(new URL("/app?mp=error", req.url));

  if (!cookie || !code || !stateParam) return errBack;

  let payload;
  try {
    payload = await verifyState(cookie);
  } catch {
    return errBack; // firma/expiración inválida
  }
  if (payload.state !== stateParam) return errBack; // anti-CSRF

  // Defensa en profundidad (Two-Pass cold P1): la cookie firmada prueba quién
  // INICIÓ el flujo; esto confirma que sigue siendo el mismo usuario + tenant +
  // rol AHORA (sesión pudo cambiar / rol pudo degradarse en la ventana de 10m).
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return errBack; // sesión perdida → fail-closed
  if (guard.user.id !== payload.userId || guard.tenantId !== payload.tenantId) {
    return errBack; // el actor/tenant cambió entre authorize y callback
  }
  const sb = await getSupabaseServerClient();
  const { data: role } = await sb.rpc("current_agency_role");
  if (role !== "dueno_admin" && role !== "encargado") return errBack; // rol degradado

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: payload.verifier,
    });
    await upsertMpCredentials(payload.tenantId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mpUserId: tokens.mpUserId,
      scope: tokens.scope,
      expiresAt: tokens.expiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
    });
  } catch (err) {
    // NO loguear tokens/secret; solo el mensaje de error.
    console.error(
      JSON.stringify({
        level: "error",
        event: "mp_oauth_callback_failed",
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return errBack;
  }

  return NextResponse.redirect(new URL("/app?mp=connected", req.url));
}
