import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditEvent } from "@/lib/auth/audit";

/**
 * POST /api/tenant/switch
 *
 * Switch the user's active tenant. The route updates `user_session_state.active_tenant_id`
 * for the authenticated user — RLS at the DB enforces that the user can only touch
 * their own row. After this call returns, the **client** must invoke
 * `supabase.auth.refreshSession()` so a new JWT is minted with the updated
 * `active_tenant_id` claim (the Custom Access Token Hook reads `user_session_state`
 * at token-issue time, see ADR-0005 §3).
 *
 * Authorization: only members of the target tenant can switch into it (403 otherwise).
 * Membership is verified via the SSR client — RLS filters non-member rows to empty,
 * so a tenant_id that the user has no membership for returns null on the lookup.
 *
 * Audit: every successful switch writes a meta-event `tenant.switched` with
 * `acting_as_tenant_id = new_tenant_id`. Audit failure does NOT abort the switch
 * (best-effort).
 *
 * Implements W3.G5.T1 (FR-AUTH-5, decisión D3).
 */

const BodySchema = z.object({
  tenant_id: z.uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { tenant_id: string };
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Membership check — RLS filters to user's own rows, so a tenant_id where
  // the user has no membership returns null.
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id, user_id, role")
    .eq("tenant_id", body.tenant_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "forbidden", details: "not a member of this tenant" },
      { status: 403 },
    );
  }

  // Upsert the active tenant — RLS allows users to write only their own row.
  const { error: upsertError } = await supabase
    .from("user_session_state")
    .upsert(
      {
        user_id: user.id,
        active_tenant_id: body.tenant_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "session state update failed", details: upsertError.message },
      { status: 500 },
    );
  }

  // Resolve the target tenant's slug for the redirect URL. Failure here is
  // non-fatal — we fall back to /app/dashboard so the user is never stranded.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", body.tenant_id)
    .maybeSingle();

  const redirectTo = tenant?.slug
    ? `/t/${tenant.slug}/dashboard`
    : "/app/dashboard";

  // Best-effort audit (NEVER block the switch if audit fails).
  try {
    await writeAuditEvent({
      action: "tenant.switched",
      actor_user_id: user.id,
      acting_as_tenant_id: body.tenant_id,
      resource_type: "user_session_state",
      resource_id: user.id,
      metadata: {
        previous_role: membership.role,
        redirect_to: redirectTo,
      },
    });
  } catch (e) {
    console.error("[tenant/switch] audit write failed (non-blocking):", e);
  }

  return NextResponse.json({ ok: true, redirectTo });
}
