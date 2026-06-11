import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { requireAgencyOwner } from "@/lib/agency/role";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { MODULES } from "@/lib/agency/modules";
import {
  Globe,
  Mountains,
  CurrencyCircleDollar,
  Handshake,
  PencilSimpleLine,
  ChatCircleText,
  CalendarCheck,
  CreditCard,
  Receipt,
  Wallet,
  Palette,
  Images,
  Robot,
  SealCheck,
  LockSimple,
} from "@phosphor-icons/react/dist/ssr";

// F-UI-BRANDED corte 4 — vista Módulos, DUEÑO-ONLY (matriz de roles v2.1).
// Grilla del mockup congelado: 13 módulos, "Incluido en tu plan" + estado
// REAL (Habilitado SOLO lo que funciona hoy — regla CEO codificada en
// lib/agency/modules.ts). Guard en la PAGE BASE (mismo patrón que Finanzas,
// catch Pass-2 SE: app.impluxa.com rewritea a /app/* sin pasar el wrapper).
export const dynamic = "force-dynamic";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Globe,
  Mountains,
  CurrencyCircleDollar,
  Handshake,
  PencilSimpleLine,
  ChatCircleText,
  CalendarCheck,
  CreditCard,
  Receipt,
  Wallet,
  Palette,
  Images,
  Robot,
};

export default async function ModulosPage() {
  // e07 claim → e08 membership → e10 owner (cadena idéntica a Finanzas).
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "modulos_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }
  await requireAgencyOwner();

  // Plan del tenant (subscriptions, patrón dashboard): display-only. Fallback
  // "FULL" = el copy del mockup congelado (PV es plan full por decisión de
  // producto; cuando billing sea real esto lee la fila real).
  const sb = getSupabaseServiceClient();
  const { data: sub, error: subError } = await sb
    .from("subscriptions")
    .select("plan_key")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (subError) {
    // display-only: el fallback no rompe nada, pero no mudo (criterio role.ts)
    console.error(
      JSON.stringify({
        level: "error",
        event: "modulos_subscription_read_failed",
        code: subError.code ?? null,
      }),
    );
  }
  const planLabel = (sub?.plan_key ?? "FULL").toUpperCase();

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1
          className="text-[26px] font-bold"
          style={{
            fontFamily: "var(--admin-heading-font, inherit)",
            color: "var(--admin-heading-color, inherit)",
          }}
        >
          Todo tu negocio, en módulos
        </h1>
        <p className="text-ash mt-1 max-w-[62ch] text-sm leading-relaxed">
          Tu plan incluye todos los módulos de la plataforma. Acá ves cuáles ya
          están funcionando en tu agencia y cuáles vienen en camino.
        </p>
        <div
          className="text-onyx mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold"
          style={{ background: "var(--admin-primary, rgb(var(--rgb-bone)))" }}
        >
          <SealCheck size={16} />
          Tu plan Impluxa: {planLabel}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = ICONS[m.icon] ?? Globe;
          return (
            <div
              key={m.key}
              className="bg-marble border-stone/60 flex flex-col gap-2.5 rounded-[14px] border p-5 shadow-[0_10px_26px_rgba(20,48,56,0.07)]"
            >
              <div className="flex items-center gap-3">
                <span className="bg-stone/30 text-bone flex h-9 w-9 flex-none items-center justify-center rounded-[10px]">
                  <Icon size={20} />
                </span>
                <span className="text-bone text-[15px] font-semibold">
                  {m.name}
                </span>
              </div>
              <p className="text-ash flex-1 text-[13px] leading-relaxed">
                {m.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-stone/30 text-bone rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  Incluido en tu plan
                </span>
                {m.status === "enabled" ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      color: "var(--badge-ok-text, #6ee7b7)",
                      background: "var(--badge-ok-bg, rgba(6,95,70,0.35))",
                    }}
                  >
                    Habilitado
                  </span>
                ) : (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      color: "var(--pill-soon-text, rgb(var(--rgb-ash)))",
                      background:
                        "var(--pill-soon-bg, color-mix(in srgb, rgb(var(--rgb-stone)) 40%, transparent))",
                    }}
                  >
                    Próximamente
                  </span>
                )}
                {m.ownerOnly && (
                  <span className="border-stone/70 text-ash inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold">
                    <LockSimple size={10} />
                    solo dueño
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
