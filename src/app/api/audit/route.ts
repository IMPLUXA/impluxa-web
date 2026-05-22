import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditEvent } from "@/lib/auth/audit";
import { requireActiveTenantOrResponse } from "@/lib/auth/guard";

/**
 * GET /api/audit?tenant=<uuid>
 *
 * Read audit_log events for a tenant. Authorization is enforced in two layers:
 *   1. Route layer (`requireActiveTenantOrResponse`): 401 unauthenticated,
 *      403 authenticated-without-active-tenant-claim (emits dedup-gated
 *      `claim_missing` / `active_tenant_null` audit event).
 *   2. Database layer (RLS policy `audit_log_select_owner`, D4 Opción B):
 *      - Platform admin reads all rows
 *      - Tenant owner reads only their tenant's rows
 *      - Nobody else reads anything (empty result)
 *
 * Tenant-scope check is delegated to Postgres RLS so a route bug cannot leak
 * cross-tenant data even if the guard is bypassed.
 *
 * After a successful read, a meta-audit event `audit.read` is written so that
 * audit log access itself is auditable. Failure of the meta-write does NOT
 * fail the read (audit outage must not deny user access).
 *
 * Implements W3.G3.T4 (FR-AUTH-7) + W1.T2 (burn-readiness telemetry).
 */
export async function GET(req: NextRequest) {
  const guardResult = await requireActiveTenantOrResponse();
  if (!guardResult.ok) return guardResult.response;
  const { user } = guardResult;

  const supabase = await getSupabaseServerClient();

  const tenantId = req.nextUrl.searchParams.get("tenant");
  if (!tenantId) {
    return NextResponse.json(
      { error: "tenant query parameter is required" },
      { status: 400 },
    );
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? 100),
    500,
  );

  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, occurred_at, action, actor_user_id, actor_session_id, acting_as_tenant_id, acting_as_role, resource_type, resource_id, ip, user_agent, request_id, metadata, prev_record_hash, record_hash",
    )
    .eq("acting_as_tenant_id", tenantId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "audit_log query failed", details: error.message },
      { status: 500 },
    );
  }

  // Meta-audit: record THIS read. Best-effort — must not block response.
  try {
    await writeAuditEvent({
      action: "audit.read",
      actor_user_id: user.id,
      acting_as_tenant_id: tenantId,
      resource_type: "audit_log",
      resource_id: tenantId,
      metadata: { rows_returned: data?.length ?? 0, limit },
    });
  } catch (e) {
    console.error("[audit.route] meta-audit write failed (non-blocking):", e);
  }

  return NextResponse.json({ events: data ?? [] });
}
