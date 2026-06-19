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
import { getAdminBasePath, mpConnectReturnPath } from "@/lib/urls";

// GET /api/mp/oauth/callback?code=...&state=... — vuelta del consentimiento MP.
// Valida state (cookie firmada single-use) vs el state echo, intercambia el code
// server-to-server (con el PKCE verifier) y persiste los tokens CIFRADOS. Redirige
// a la sección Cobros del panel (HOST-AWARE, UI-connect s57) con ?mp=connected | ?mp=error
// (sin filtrar detalle). El exchange real necesita F0 (creds en env).
export async function GET(req: NextRequest) {
  // Guard SIGNAL-14: el callback escribe tokens a tenant_mp_credentials (prod). En
  // preview/dev (el env apunta a prod, sin preview-DB) NO debe mutar -> fue la ruta que
  // mas muto prod desde un preview en s55 (round-trip OAuth). 403 antes de tocar
  // cookie/exchange/upsert. VERCEL_ENV ausente local = permitido.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_NON_PROD" },
      { status: 403 },
    );
  }

  const store = await cookies();
  const cookie = store.get(MP_OAUTH_STATE_COOKIE)?.value;
  // single-use: limpiar la cookie SIEMPRE, pase lo que pase.
  store.delete(MP_OAUTH_STATE_COOKIE);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  // Target host-aware del retorno (UI-connect s57): en .ar → /admin/pagos, en
  // app.impluxa.com → /pagos. Cierra el 404 cosmético del connect del dueño.
  const basePath = await getAdminBasePath();

  // Observabilidad PURA (s55): cada rechazo pre-exchange loguea un reason-code NO
  // sensible para diagnosticar por qué corta el callback. NUNCA tokens, NUNCA el
  // valor de la cookie/state, NUNCA PII: solo el código de motivo, booleanos de
  // PRESENCIA (has_*) y el label de rol (no sensible).
  const reject = (reason: string, extra?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "mp_oauth_callback_reject",
        reason,
        ...extra,
      }),
    );
    return NextResponse.redirect(
      new URL(mpConnectReturnPath(basePath, "error"), req.url),
    );
  };

  if (!cookie || !code || !stateParam)
    return reject("missing_params", {
      has_cookie: !!cookie,
      has_code: !!code,
      has_state: !!stateParam,
    });

  let payload;
  try {
    payload = await verifyState(cookie);
  } catch {
    return reject("state_verify_failed"); // firma/expiración inválida
  }
  if (payload.state !== stateParam) return reject("state_mismatch"); // anti-CSRF

  // Defensa en profundidad (Two-Pass cold P1): la cookie firmada prueba quién
  // INICIÓ el flujo; esto confirma que sigue siendo el mismo usuario + tenant +
  // rol AHORA (sesión pudo cambiar / rol pudo degradarse en la ventana de 10m).
  const guard = await requireActiveTenantOrResponse();
  if (!guard.ok) return reject("no_active_session"); // sesión perdida → fail-closed
  if (guard.user.id !== payload.userId || guard.tenantId !== payload.tenantId) {
    return reject("actor_or_tenant_mismatch"); // el actor/tenant cambió entre authorize y callback
  }
  const sb = await getSupabaseServerClient();
  const { data: role } = await sb.rpc("current_agency_role");
  if (role !== "dueno_admin" && role !== "encargado")
    return reject("role_not_allowed", { role: role ?? null }); // rol degradado

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
    return NextResponse.redirect(
      new URL(mpConnectReturnPath(basePath, "error"), req.url),
    );
  }

  return NextResponse.redirect(
    new URL(mpConnectReturnPath(basePath, "connected"), req.url),
  );
}
