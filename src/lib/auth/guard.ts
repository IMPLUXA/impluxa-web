import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isApprovalGateBypassed } from "@/lib/runtime-config";
import { writeAuditEvent, type TenantClaimAction } from "./audit";

/**
 * Sentinel tenant ID returned when the kill switch (ADR-0005 §5,
 * `APPROVAL_GATE_ENABLED=0`) is engaged. Downstream tenant-isolation
 * queries WILL NOT match this value, so the bypass is fail-loud at the
 * data layer even though the auth layer permits the request through.
 * This is deliberate: the break-glass exists to unblock auth, NOT to
 * grant data access. Operators who need data access during emergency
 * must additionally disable RLS at the database layer.
 */
const APPROVAL_GATE_BYPASS_TENANT_ID = "__bypass__";

/**
 * Emits a forensic audit event whenever the kill switch fires. Uses the
 * same RPC path as TenantClaimAction events but with a distinct `action`
 * value so the dedup gate (PK on tenant-claim actions only) does NOT
 * apply — every bypass is recorded. Failures are logged but swallowed
 * because the bypass already implies we are in a degraded state.
 */
async function emitApprovalGateBypassAudit(
  user: { id: string },
  entrypoint: "page" | "api",
  accessToken: string | undefined,
): Promise<void> {
  const jti = extractJti(accessToken);
  try {
    await writeAuditEvent({
      action: "approval_gate_bypassed",
      jwt_jti: jti,
      actor_user_id: user.id,
      metadata: { entrypoint },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "audit_write_failed",
        reason: "approval_gate_bypassed",
        entrypoint,
        user_id: user.id,
        has_jti: jti !== undefined,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const role = user.app_metadata?.role;
  if (role !== "admin") redirect("/login?error=forbidden");
  return user;
}

type AuthUser = Awaited<ReturnType<typeof requireUser>>;

type ActiveTenantClaimResult =
  | { ok: true; tenantId: string }
  | { ok: false; reason: TenantClaimAction };

/**
 * Reads the `active_tenant_id` claim from the DECODED access token (JWT
 * top-level). The hook `custom_access_token_hook` (migration
 * 20260514_v025_003) injects this claim at the JWT TOP LEVEL — NOT into
 * `app_metadata` (which maps to the `auth.users.app_metadata` DB column and
 * never carries hook-injected claims; `getUser().app_metadata` exposes that
 * column, not the JWT payload). This matches `current_active_tenant()`
 * (helper v025_002) which also reads `auth.jwt() ->> 'active_tenant_id'`,
 * so guard and RLS read the SAME source.
 *
 * Fix s46: the previous read of `user.app_metadata.active_tenant_id` was
 * always `undefined` → `claim_missing` → e07 for EVERY user; the claim never
 * lived in `app_metadata`. Latent because the back-office `/app` (behind this
 * guard) had no real OTP→dashboard login until s46 (LIVE tenants are public,
 * loginless).
 *
 * `decodeJwt` parses the payload WITHOUT re-verifying the signature — safe
 * because the caller established authenticity via `supabase.auth.getUser()`
 * (validated server-side against gotrue) before passing this token; same
 * pattern as `extractJti`. A missing or malformed token → `claim_missing`
 * (fail-closed), never an unhandled throw.
 *
 * Returns a discriminated result. `claim_missing`: token absent/malformed or
 * claim undefined. `active_tenant_null`: claim present but unusable (literal
 * null, empty string, or non-string type).
 */
function readActiveTenantClaim(
  accessToken: string | undefined,
): ActiveTenantClaimResult {
  if (!accessToken) return { ok: false, reason: "claim_missing" };
  let claim: unknown;
  try {
    claim = decodeJwt(accessToken)["active_tenant_id"];
  } catch {
    // Malformed token — fail-closed, never throw out of the guard.
    return { ok: false, reason: "claim_missing" };
  }
  if (claim === undefined) return { ok: false, reason: "claim_missing" };
  if (claim === null || claim === "")
    return { ok: false, reason: "active_tenant_null" };
  if (typeof claim !== "string")
    return { ok: false, reason: "active_tenant_null" };
  return { ok: true, tenantId: claim };
}

/**
 * Extracts `jti` from the verified access token without re-checking the
 * signature. Safe because the token came from `supabase.auth.getUser()`
 * which already validated it server-side against gotrue. `decodeJwt` here
 * only parses the public payload to read a public identifier; auth has
 * already been established by the caller.
 *
 * Returns undefined when the token is absent or parse fails — the writer
 * then falls back to the no-dedup legacy path (T5 backward-compat).
 */
function extractJti(accessToken: string | undefined): string | undefined {
  if (!accessToken) return undefined;
  try {
    const payload = decodeJwt(accessToken);
    if (typeof payload.jti === "string" && payload.jti.length > 0) {
      return payload.jti;
    }
  } catch {
    // malformed token — proceed without jti
  }
  return undefined;
}

/**
 * Emits a tenant-claim audit event. The RPC's atomic dedup gate
 * (PK `(jwt_jti, action)` + `ON CONFLICT DO NOTHING`) ensures concurrent
 * retries from the same JWT only persist one row.
 *
 * `writeAuditEvent` throws on RPC failure to preserve hash-chain
 * monotonicity (audit.ts L33-34 design intent). We emit a structured
 * stderr log before propagating so Vercel/Sentry capture the failure
 * even when an upstream caller swallows the exception.
 */
async function emitTenantClaimAudit(
  user: AuthUser,
  reason: TenantClaimAction,
  accessToken: string | undefined,
): Promise<void> {
  const jti = extractJti(accessToken);
  try {
    await writeAuditEvent({
      action: reason,
      jwt_jti: jti,
      actor_user_id: user.id,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "audit_write_failed",
        reason,
        user_id: user.id,
        has_jti: jti !== undefined,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    throw err;
  }
}

export type RequireActiveTenantPageResult = {
  user: AuthUser;
  tenantId: string;
};

/**
 * Server Components / Pages guard. Throws via `redirect()` when the user
 * has no usable `active_tenant_id` claim, after emitting a dedup-gated
 * audit event. Calling this from an API route (Route Handler) will crash
 * because `redirect()` is server-component-only — use
 * `requireActiveTenantOrResponse` instead.
 *
 * The redirect query parameter is an opaque short code (`e07`) rather
 * than the literal reason, so probes don't leak the differentiator to
 * Vercel access logs, browser history, or the Referer header on the next
 * navigation.
 */
export async function requireActiveTenantOrRedirect(): Promise<RequireActiveTenantPageResult> {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (isApprovalGateBypassed()) {
    await emitApprovalGateBypassAudit(user, "page", session?.access_token);
    return { user, tenantId: APPROVAL_GATE_BYPASS_TENANT_ID };
  }
  // Lee el claim del JWT decodificado (top-level), donde el hook lo inyecta.
  const result = readActiveTenantClaim(session?.access_token);
  if (!result.ok) {
    await emitTenantClaimAudit(user, result.reason, session?.access_token);
    redirect("/login?e=e07");
  }
  return { user, tenantId: result.tenantId };
}

export type RequireActiveTenantApiResult =
  | { ok: true; user: AuthUser; tenantId: string }
  | { ok: false; response: NextResponse };

/**
 * API Route Handler guard. Returns a `NextResponse` instead of throwing,
 * so the caller can short-circuit cleanly. Response body is minimal
 * (`{error, code}`) — no PII (user_id, tenant_id, jti, traceId) to avoid
 * leaking discriminators that aid enumeration.
 *
 * Statuses: 401 for unauthenticated, 403 for authenticated-but-no-tenant.
 */
export async function requireActiveTenantOrResponse(): Promise<RequireActiveTenantApiResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", code: "E_AUTH" },
        { status: 401 },
      ),
    };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (isApprovalGateBypassed()) {
    await emitApprovalGateBypassAudit(user, "api", session?.access_token);
    return { ok: true, user, tenantId: APPROVAL_GATE_BYPASS_TENANT_ID };
  }
  // Lee el claim del JWT decodificado (top-level), donde el hook lo inyecta.
  const result = readActiveTenantClaim(session?.access_token);
  if (!result.ok) {
    await emitTenantClaimAudit(user, result.reason, session?.access_token);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", code: "E_TENANT_CLAIM" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user, tenantId: result.tenantId };
}
