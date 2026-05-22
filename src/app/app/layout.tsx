import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { Sidebar } from "@/components/app/Sidebar";
import { redirect } from "next/navigation";

// Auth-gated route -- must be dynamic (uses cookies via Supabase SSR client).
// Without this, Next 16 throws "Page changed from static to dynamic at runtime".
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getCurrentTenant(user.id);
  if (!tenant) redirect("/login?error=no_tenant");
  // W1.T2 nit-MED fix: defense-in-depth against silent drift between the
  // JWT `active_tenant_id` claim (authoritative per hook) and the tenant
  // resolved by `getCurrentTenant(user.id)` (resolves via membership). A
  // divergence here means burn-readiness gate corruption — the user would
  // see one tenant while audit/RLS scope to another. Fail-closed redirect
  // with structured log for ops triage. Error code `e08_drift` is opaque
  // to the user to avoid leaking the discriminator.
  if (tenant.id !== tenantId) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "app_layout",
        user_id: user.id,
        claim_tenant_id: tenantId,
        membership_tenant_id: tenant.id,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  return (
    <div className="bg-onyx text-bone flex min-h-screen">
      <Sidebar tenant={tenant} user={user} />
      <main className="flex-1 p-6 pb-24 md:ml-64 md:pb-6">{children}</main>
    </div>
  );
}
