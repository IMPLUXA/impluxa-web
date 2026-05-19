import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Tenant-claim audit actions tracked by `audit_dedup` (migration
 * 20260518_v026_001_audit_dedup.sql). Dedup gate fires only when
 * `jwt_jti` is present AND `action` is one of these values.
 */
export type TenantClaimAction = "claim_missing" | "active_tenant_null";

/**
 * Known action types. Kept as a `const` union for type-safe writers (guards,
 * hooks) without forcing every legacy/ad-hoc action through this surface —
 * `AuditEvent.action` remains `string` to preserve backward-compat with
 * pre-existing call sites that emit free-form actions (e.g. `auth.login`,
 * `audit.read`).
 */
export type AuditAction = TenantClaimAction | (string & {});

/**
 * Audit event payload accepted by `public.append_audit(jsonb)` (migration
 * 20260514_v025_005_audit_log.sql, extended sesion 10a with audit_dedup
 * gate at 20260518_v026_001_audit_dedup.sql). The DB trigger fills
 * `prev_record_hash` and `record_hash` to maintain the tamper-evident
 * chain (ADR-0007).
 *
 * Only `action` is required. Server-side handlers SHOULD enrich with as much
 * context as available; missing fields land as NULL in the row and serialize
 * as empty strings in the hash payload.
 *
 * `jwt_jti` (v0.2.6 W1.T1 paso 5): JWT identifier from the verified access
 * token. When present AND `action` is a `TenantClaimAction`, the RPC's atomic
 * dedup gate (PK `(jwt_jti, action)` + `ON CONFLICT DO NOTHING`) prevents
 * duplicate rows across concurrent retries. Callers SHOULD pass it on every
 * write where the JTI is known; absent JTI falls back to the legacy
 * write-every-time path (no chain semantics change).
 */
export interface AuditEvent {
  action: AuditAction;
  jwt_jti?: string;
  actor_user_id?: string;
  actor_session_id?: string;
  acting_as_tenant_id?: string;
  acting_as_role?: string;
  resource_type?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  request_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Server-only audit log writer. Calls `public.append_audit` RPC with the event
 * wrapped as `p_event`. The RPC is granted to service_role exclusively
 * (SE-H1 mitigation); authenticated and anon cannot execute it.
 *
 * Errors thrown to the caller — DO NOT swallow. A silently failed audit write
 * is worse than the action being aborted, because it breaks the chain's
 * monotonicity guarantee on the next successful write.
 *
 * @throws when `action` is empty or when Supabase returns an error.
 */
/**
 * Tenant-claim actions covered by the audit_dedup PK gate. Kept in sync
 * with the `audit_dedup_action_chk` CHECK constraint
 * (migration 20260518_v026_001_audit_dedup.sql L25) and the
 * `TenantClaimAction` discriminated union above.
 */
const TENANT_CLAIM_ACTIONS = new Set<string>([
  "claim_missing",
  "active_tenant_null",
]);

export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  if (!event?.action) {
    throw new Error("audit_log write failed: action is required");
  }

  // B-COLD-1 (s13 Two-Pass cold round): when a tenant-claim action is
  // emitted without `jwt_jti`, the audit_dedup gate silently falls back
  // to the legacy write-every-time path. The fallback is semantically
  // correct (dedup is best-effort), but the resulting audit_log noise
  // corrupts the RLS burn-gate verdict (false `claim_missing > 0`).
  // Log warn for operational visibility; integration tests (s14) assert.
  if (
    TENANT_CLAIM_ACTIONS.has(event.action) &&
    (!event.jwt_jti || event.jwt_jti.length === 0)
  ) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "audit_dedup_bypass_missing_jti",
        action: event.action,
        actor_user_id: event.actor_user_id,
      }),
    );
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("append_audit", { p_event: event });

  if (error) {
    throw new Error(`audit_log write failed: ${error.message}`);
  }
}
