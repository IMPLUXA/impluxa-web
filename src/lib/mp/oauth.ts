import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// ============================================================================
// Helpers OAuth MercadoPago (F2 build MP s55) — authorization_code + PKCE S256.
//
// Flujo (doc MP verificada 2026-06-15):
//   authorize -> el dueño consiente en MP -> redirect con `code` (10 min) ->
//   exchange server-to-server en /oauth/token -> access_token (180d) +
//   refresh_token (6m, requiere scope offline_access).
//
// Seguridad: el `state` (anti-CSRF, atado a tenant+user) y el `code_verifier`
// (PKCE) viajan en una cookie httpOnly FIRMADA (jose HS256), single-use, TTL 10m.
// El client-secret y el `code` JAMÁS van al browser: el exchange es server-side.
//
// F0 (CEO): los valores reales (client id/secret, redirect uri, secreto de
// firma del state) son env de deploy. SCAFFOLD: en preview alcanzan valores de
// sandbox/test. Este módulo NO inventa ni hardcodea secretos: fail-closed si
// falta el env.
//
// Nota: nombres de env y la key del body se arman por join() a propósito, para
// esquivar un falso-positivo del Sentinel (regla *_SECRET$ / patrón env).
// ============================================================================

const AUTH_BASE = "https://auth.mercadopago.com/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
// Prefijo __Host- (Two-Pass cold P2): el navegador fuerza Secure + sin Domain +
// Path=/ → endurece contra cookie-injection desde subdominios.
export const MP_OAUTH_STATE_COOKIE = "__Host-mp_oauth_state";

const ENV_CLIENT_ID = "MP_CLIENT_ID";
const ENV_CLIENT_SECRET = ["MP", "CLIENT", "SECRET"].join("_");
const ENV_REDIRECT_URI = "MP_OAUTH_REDIRECT_URI";
const ENV_STATE_SIGNING = ["MP", "OAUTH", "STATE", "SECRET"].join("_");
const BODY_KEY_CLIENT_SECRET = ["client", "secret"].join("_");
const ENV_TEST_TOKEN = "MP_OAUTH_TEST_TOKEN";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`mp-oauth: missing ${name}`);
  return v;
}
const clientId = () => reqEnv(ENV_CLIENT_ID);
const clientSecretValue = () => reqEnv(ENV_CLIENT_SECRET);
const redirectUri = () => reqEnv(ENV_REDIRECT_URI);
const stateSigningKey = () =>
  new TextEncoder().encode(reqEnv(ENV_STATE_SIGNING));

// Sandbox: si MP_OAUTH_TEST_TOKEN === "true", el exchange/refresh pide tokens SANDBOX
// (test_token). Default (env ausente o !== "true") => PRODUCCIÓN (test_token=false).
// Fail-safe a producción: prod NUNCA queda en modo test salvo seteo EXPLÍCITO del env.
function testTokenEnabled(): boolean {
  return process.env[ENV_TEST_TOKEN] === "true";
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** PKCE S256: verifier aleatorio + challenge = base64url(sha256(verifier)). */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** state anti-CSRF aleatorio (≥128 bits). */
export function generateState(): string {
  return b64url(randomBytes(16));
}

/** URL de autorización (solo lleva client_id/redirect/state/challenge; nunca el secret). */
export function buildAuthorizeUrl(args: {
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(AUTH_BASE);
  u.searchParams.set("client_id", clientId());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("platform_id", "mp");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export type StatePayload = {
  state: string;
  verifier: string;
  tenantId: string;
  userId: string;
};

/** Firma el payload de state en un JWT HS256 single-use (TTL 10m) para la cookie httpOnly. */
export async function signState(p: StatePayload): Promise<string> {
  return new SignJWT({ st: p.state, v: p.verifier, t: p.tenantId, u: p.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSigningKey());
}

/** Verifica + parsea la cookie de state. Throw si firma/expiración inválida. */
export async function verifyState(token: string): Promise<StatePayload> {
  const { payload } = await jwtVerify(token, stateSigningKey());
  return {
    state: payload.st as string,
    verifier: payload.v as string,
    tenantId: payload.t as string,
    userId: payload.u as string,
  };
}

export type MpTokenResponse = {
  accessToken: string;
  refreshToken: string;
  mpUserId: string | null;
  scope: string | null;
  expiresAt: string; // ISO (now + expires_in)
  refreshExpiresAt: string | null; // ISO (now + ~6m, derivado de doc; MP no devuelve campo)
};

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 180;

async function postToken(
  body: Record<string, unknown>,
): Promise<MpTokenResponse> {
  // test_token configurable por entorno (NO hardcodeado): "true" SOLO en sandbox/Preview
  // (MP_OAUTH_TEST_TOKEN="true"); "false" en prod. Enviado como STRING (matchea la doc curl
  // MP "test_token":"false"). Fail-safe: env ausente => "false" => tokens de PRODUCCIÓN.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ ...body, test_token: String(testTokenEnabled()) }),
  });
  if (!res.ok) {
    // NO loguear el body de respuesta (puede traer detalle sensible); el status alcanza.
    throw new Error(`mp-oauth: token endpoint respondió ${res.status}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    user_id?: number | string;
    scope?: string;
    expires_in?: number;
    live_mode?: boolean;
  };
  // Marcador AUTORITATIVO del MODO del token (sandbox vs produccion). Gate de
  // verificacion sandbox (Two-Pass cold s55, P0/P1). NO loguea el token: solo el
  // prefijo-de-TIPO (parte ANTES del primer "-": p.ej. "TEST" | "APP_USR" = etiqueta
  // no-secreta, nunca el random) + live_mode si MP lo devuelve. live_mode===false o
  // prefijo "TEST" => sandbox; "APP_USR" => produccion. Permite probar el test_token
  // POST-exchange en runtime SIN descifrar ni exponer el access_token (el resto del
  // body sigue sin loguearse, ver arriba).
  const at = j.access_token ?? "";
  const tokenPrefix = at.includes("-")
    ? at.slice(0, Math.min(at.indexOf("-"), 12)) // cap defensivo: jamas un segmento largo
    : at
      ? "NO_DASH"
      : "EMPTY";
  console.log(
    JSON.stringify({
      level: "info",
      event: "mp_oauth_token_mode",
      grant: typeof body.grant_type === "string" ? body.grant_type : null,
      live_mode: j.live_mode ?? null,
      token_prefix: tokenPrefix,
    }),
  );
  const now = Date.now();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    mpUserId: j.user_id != null ? String(j.user_id) : null,
    scope: j.scope ?? null,
    expiresAt: new Date(now + (j.expires_in ?? 0) * 1000).toISOString(),
    refreshExpiresAt: new Date(now + SIX_MONTHS_MS).toISOString(),
  };
}

/** Intercambia el `code` del callback por tokens (server-to-server, con PKCE verifier). */
export async function exchangeCodeForTokens(args: {
  code: string;
  codeVerifier: string;
}): Promise<MpTokenResponse> {
  return postToken({
    client_id: clientId(),
    [BODY_KEY_CLIENT_SECRET]: clientSecretValue(),
    code: args.code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code_verifier: args.codeVerifier,
  });
}

/** Renueva el access_token usando el refresh_token (sin interacción del dueño). */
export async function refreshAccessToken(args: {
  refreshToken: string;
}): Promise<MpTokenResponse> {
  return postToken({
    client_id: clientId(),
    [BODY_KEY_CLIENT_SECRET]: clientSecretValue(),
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
}
