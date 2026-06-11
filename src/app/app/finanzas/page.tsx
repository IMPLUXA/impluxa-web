import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { requireAgencyOwner } from "@/lib/agency/role";
import { redirect } from "next/navigation";

// F-UI-BRANDED corte 3 — Finanzas: DUEÑO-ONLY (matriz de roles v2.1).
// Página placeholder "pronto" (la pantalla real de comisiones/liquidaciones
// es F9-F11, gate financiero). Su razón de existir HOY: ser la ruta dueño-only
// alcanzable que prueba el guard server-side — un vendedor que tipea la URL
// REBOTA acá, no ve cascarón ni datos.
//
// El guard vive en la PAGE BASE (no solo en el wrapper tenant): app.impluxa.com
// rewritea a /app/finanzas y la base es alcanzable sin pasar por el wrapper
// (catch Pass-2 SE del plan). force-dynamic: lee rol del caller (cookies).
export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  // e07 → e08 (tenant activo + membership real, fail-closed)…
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "finanzas_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }
  // …y e10: SOLO dueño (rebota opaco si no). La RLS sigue siendo la autoridad
  // de datos; esto autoriza la NAVEGACIÓN a la sección dueño-only.
  await requireAgencyOwner();

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1
          className="text-[26px] font-bold"
          style={{
            fontFamily: "var(--admin-heading-font, inherit)",
            color: "var(--admin-heading-color, inherit)",
          }}
        >
          Finanzas
        </h1>
        <p className="text-ash mt-1 text-sm">
          Comisiones de dueños y vendedores, y liquidaciones de cada venta.
        </p>
      </header>

      <div className="bg-marble border-stone/60 rounded-[14px] border p-8 text-center shadow-[0_10px_26px_rgba(20,48,56,0.07)]">
        <div className="text-ash text-sm font-semibold tracking-wide uppercase">
          Próximamente
        </div>
        <p className="text-ash mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
          Acá vas a ver y liquidar las comisiones de tu agencia. Se activa junto
          con el motor de pagos.
        </p>
      </div>
    </div>
  );
}
