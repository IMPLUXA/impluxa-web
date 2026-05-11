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

export async function getCurrentTenant(userId: string): Promise<Tenant | null> {
  const tenants = await getUserTenants(userId);
  return tenants[0] ?? null;
}
