import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Audit event payload accepted by `public.append_audit(jsonb)` (migration
 * 20260514_v025_005_audit_log.sql). The DB trigger fills `prev_record_hash`
 * and `record_hash` to maintain the tamper-evident chain (ADR-0007).
 *
 * Only `action` is required. Server-side handlers SHOULD enrich with as much
 * context as available; missing fields land as NULL in the row and serialize
 * as empty strings in the hash payload.
 */
export interface AuditEvent {
  action: string;
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
export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  if (!event?.action) {
    throw new Error("audit_log write failed: action is required");
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("append_audit", { p_event: event });

  if (error) {
    throw new Error(`audit_log write failed: ${error.message}`);
  }
}
