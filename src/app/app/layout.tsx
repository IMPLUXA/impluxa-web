import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
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
  // Membership-aware (fix s46): resuelve el tenant ACTIVO (claim `active_tenant_id`,
  // autoritativo per hook) confirmando que es una membership REAL del user.
  // `null` = el claim no matchea ninguna membership (drift / claim corrupto /
  // tamper) → fail-closed redirect con `e08_drift` opaco. Soporta usuarios
  // multi-tenant: usa el tenant activo válido, NO `tenants[0]` (que rompía el
  // caso multi-tenant cuando el active != primer membership). NOTA: upstream
  // `requireActiveTenantOrRedirect` solo valida la FORMA del claim (e07: claim
  // ausente/null/no-string), NO que exista la membership; la pertenencia REAL
  // se confirma acá (null = no-member o claim tampered → fail-closed).
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "app_layout",
        user_id: user.id,
        claim_tenant_id: tenantId,
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
