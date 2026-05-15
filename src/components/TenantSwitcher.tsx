import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TenantSwitcherClient } from "./TenantSwitcherClient";

/**
 * TenantSwitcher — server component that fetches the authenticated user's
 * tenant memberships and renders a dropdown to switch active tenant.
 *
 * Data path: SSR client → `tenant_members` JOIN `tenants` filtered by RLS to
 * only the user's own memberships. The active tenant ID comes from
 * `user_session_state` (source of truth — the JWT claim is its reflection).
 *
 * Implements W3.G5.T1 part 2 (FR-AUTH-5, D3). Companion of POST
 * `/api/tenant/switch` (commit `efa6a4b`).
 */
export async function TenantSwitcher() {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [memberships, sessionState] = await Promise.all([
    supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants(id, slug, name, status)")
      .eq("user_id", user.id),
    supabase
      .from("user_session_state")
      .select("active_tenant_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (memberships.error || !memberships.data) {
    return null;
  }

  type TenantRow = {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
  type MembershipRow = {
    tenant_id: string;
    role: string;
    // Supabase types nested FK selects as arrays by default; we know this
    // join is many-to-one so we coerce to single via [0].
    tenants: TenantRow | TenantRow[] | null;
  };

  const tenants = (memberships.data as unknown as MembershipRow[])
    .map((m) => {
      const t = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
      return t
        ? {
            id: t.id,
            slug: t.slug,
            name: t.name,
            role: m.role,
            status: t.status,
          }
        : null;
    })
    .filter(
      (
        t,
      ): t is {
        id: string;
        slug: string;
        name: string;
        role: string;
        status: string;
      } => t !== null,
    );

  if (tenants.length === 0) return null;

  const activeId =
    sessionState.data?.active_tenant_id ?? tenants[0]?.id ?? null;

  return <TenantSwitcherClient tenants={tenants} activeTenantId={activeId} />;
}
