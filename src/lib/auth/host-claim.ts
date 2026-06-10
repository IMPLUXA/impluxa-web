import "server-only";
import { redirect } from "next/navigation";
import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import type { Tenant } from "@/lib/tenants/types";

/**
 * B-Fase2 — HOST-VS-CLAIM fail-closed (decisión CEO s46: e09, SIN auto-switch).
 *
 * Para el árbol admin bajo el dominio del cliente (/tenant/[slug]/admin):
 * el slug del path (derivado del Host por el middleware) debe corresponder
 * al MISMO tenant que el claim `active_tenant_id` del JWT. Si difieren, el
 * usuario está mirando el admin de un dominio que no es su tenant activo →
 * redirect opaco `e09` (mismo código para slug inexistente y slug ajeno:
 * sin oráculo de existencia; cambiar de tenant es un acto EXPLÍCITO vía
 * TenantSwitcher, nunca un auto-switch silencioso).
 *
 * Capas previas (las corre esta misma función, en orden):
 *  1. requireActiveTenantOrRedirect → autenticación + forma del claim (e07).
 *  2. getActiveTenant → membership REAL del claim (e08_drift).
 *  3. host-vs-claim (e09) — esta capa.
 *
 * Se invoca en el layout admin Y en CADA page wrapper (C2 del review:
 * App Router no re-ejecuta layouts en soft navigation — un switch de tenant
 * en otra tab re-minta el claim y la soft-nav esquivaría el check del layout).
 * La autoridad de DATOS sigue siendo el claim + RLS; esto es consistencia
 * host↔contexto y audit trail coherente.
 */
export async function assertHostMatchesClaim(
  slug: string,
): Promise<{ user: { id: string; email?: string }; tenant: Tenant }> {
  const { user, tenantId } = await requireActiveTenantOrRedirect();

  const active = await getActiveTenant(user.id, tenantId);
  if (!active) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "tenant_admin",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }

  // C1: slug inexistente (null) y slug-de-otro-tenant producen EXACTAMENTE
  // el mismo redirect — nunca comparación sobre null, nunca oráculo.
  const hostTenant = await resolveTenantBySlug(slug);
  if (!hostTenant || hostTenant.id !== active.id) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "host_claim_mismatch",
        scope: "tenant_admin",
        user_id: user.id,
        claim_tenant_id: tenantId,
        path_slug: slug,
      }),
    );
    redirect("/login?e=e09");
  }

  return { user, tenant: active };
}
