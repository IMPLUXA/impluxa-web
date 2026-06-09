import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { Tenant } from "./types";

export async function getUserTenants(userId: string): Promise<Tenant[]> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("tenant_members")
    .select("tenant:tenants(*)")
    .eq("user_id", userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.tenant).filter(Boolean);
}

/**
 * @deprecated Devuelve `tenants[0]` (primer membership), que NO respeta el
 * `active_tenant_id` claim y ROMPE para usuarios multi-tenant (falso-drift en
 * los guards de /app). Para resolver el tenant de un usuario en un guard usá
 * `getActiveTenant(userId, activeTenantId)`. Se conserva por compat de tests.
 */
export async function getCurrentTenant(userId: string): Promise<Tenant | null> {
  const tenants = await getUserTenants(userId);
  return tenants[0] ?? null;
}

/**
 * Resuelve el tenant ACTIVO de un usuario: el membership cuyo tenant.id ===
 * activeTenantId. Devuelve null si el user NO es member de ese tenant (= el
 * claim active_tenant no matchea ninguna membership = drift/tamper → fail-closed
 * en el caller). Membership-aware: a diferencia de getCurrentTenant (que devuelve
 * tenants[0] y rompe para usuarios multi-tenant cuyo active != primer membership),
 * esto usa el tenant activo real. Query directa (1 row) en vez de filtrar en memoria.
 */
export async function getActiveTenant(
  userId: string,
  activeTenantId: string,
): Promise<Tenant | null> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("tenant_members")
    .select("tenant:tenants(*)")
    .eq("user_id", userId)
    .eq("tenant_id", activeTenantId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any)?.tenant as Tenant | undefined) ?? null;
}
