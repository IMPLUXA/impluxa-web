import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { Tenant } from "./types";

type CacheEntry = { value: Tenant | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

export function __resetCache() {
  cache.clear();
}

const TENANT_COLS =
  "id,slug,name,template_key,custom_domain,status,trial_ends_at,created_by,created_at,updated_at";

export async function resolveTenantBySlug(
  slug: string,
): Promise<Tenant | null> {
  const now = Date.now();
  const hit = cache.get(slug);
  if (hit && hit.expiresAt > now) return hit.value;

  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select(TENANT_COLS)
    .eq("slug", slug)
    .maybeSingle();

  const value = (data as Tenant) ?? null;
  cache.set(slug, { value, expiresAt: now + TTL_MS });
  return value;
}

export async function resolveTenantByDomain(
  domain: string,
): Promise<Tenant | null> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select(TENANT_COLS)
    .eq("custom_domain", domain)
    .maybeSingle();
  return (data as Tenant) ?? null;
}
