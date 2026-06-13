import { requireActiveTenantOrRedirect } from "@/lib/auth/guard";
import { getActiveTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminBasePath, siteUrl, siteHostLabel } from "@/lib/urls";

// F-UI-BRANDED corte 2 — Inicio del mockup congelado v2.1, DATA-GATED
// (patrón dormant-ship de la casa): tenants CON catálogo de excursiones ven
// la vista agencia (KPIs + tabla de tarifas vigentes, APIs F3b reales);
// tenants SIN catálogo (Hakuna) conservan EXACTAMENTE la vista previa de
// leads — cero cambio de comportamiento fuera del vertical agencia.
// La page es compartida por /app y el árbol branded: los tokens remapeados
// del layout branded la pintan light; en /app queda dark como siempre.

const fmtARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default async function Dashboard() {
  const { user, tenantId } = await requireActiveTenantOrRedirect();
  // Membership-aware (fix s46): ver layout.tsx. Resuelve el tenant activo del
  // claim confirmando membership real; null = drift → fail-closed. Multi-tenant safe.
  const tenant = await getActiveTenant(user.id, tenantId);
  if (!tenant) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "tenant_claim_membership_drift",
        scope: "dashboard_page",
        user_id: user.id,
        claim_tenant_id: tenantId,
      }),
    );
    redirect("/login?e=e08_drift");
  }
  const sb = getSupabaseServiceClient();
  const isDraft = tenant.status !== "published";
  // basePath display/nav-only (B-Fase2): "" en /app, "/admin" bajo el dominio
  // del cliente — esta page es compartida por ambos árboles.
  const basePath = await getAdminBasePath();

  // Gate de vertical: hay catálogo => vista agencia (mockup v2.1).
  const { data: excursions } = await sb
    .from("excursions")
    .select("id,name,active")
    .eq("tenant_id", tenant.id)
    .order("name");

  if (excursions && excursions.length > 0) {
    const activeExc = excursions.filter((e) => e.active);
    const excIds = excursions.map((e) => e.id);
    const [{ data: currentRates }, firstHistory] = await Promise.all([
      sb
        .from("excursion_rates")
        .select("excursion_id,base_price")
        .eq("tenant_id", tenant.id)
        .is("valid_to", null)
        .in("excursion_id", excIds),
      sb
        .from("excursion_rates")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("excursion_id", excursions[0]!.id),
    ]);

    const rateByExc = new Map(
      (currentRates ?? []).map((r) => [
        r.excursion_id as string,
        Number(r.base_price),
      ]),
    );
    const first = excursions[0]!;
    const firstRate = rateByExc.get(first.id);

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
            Tu agencia hoy
          </h1>
          <p className="text-ash mt-1 text-sm">
            Resumen de {tenant.name} al día de la fecha.
          </p>
        </header>

        {isDraft && (
          <div className="flex items-center justify-between rounded-lg border border-yellow-600 bg-yellow-900/20 p-4">
            <span>⚠️ Tu sitio está en borrador.</span>
            <Link href={`${basePath}/site/content`} className="underline">
              Editar y publicar →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-marble border-stone/60 rounded-[14px] border p-5 shadow-[0_10px_26px_rgba(20,48,56,0.07)]">
            <div className="text-ash text-[13px] font-semibold">
              Excursiones activas
            </div>
            <div className="text-bone mt-2 text-3xl font-bold">
              {activeExc.length}
            </div>
            <div className="text-ash mt-1 text-[12.5px]">
              catálogo publicado en tu sitio
            </div>
          </div>
          <div className="bg-marble border-stone/60 rounded-[14px] border p-5 shadow-[0_10px_26px_rgba(20,48,56,0.07)]">
            <div className="text-ash text-[13px] font-semibold">
              Tarifa vigente · {first.name}
            </div>
            <div className="text-bone mt-2 text-3xl font-bold">
              {firstRate != null ? fmtARS.format(firstRate) : "sin tarifa"}
            </div>
            <div className="text-ash mt-1 text-[12.5px]">
              {firstHistory.count ?? 0} versiones en el historial
            </div>
          </div>
          <Link
            href={`${basePath}/agency/reservas`}
            className="bg-marble border-stone/60 hover:border-stone block rounded-[14px] border p-5 shadow-[0_10px_26px_rgba(20,48,56,0.07)] transition hover:shadow-[0_14px_34px_rgba(20,48,56,0.13)]"
          >
            <div className="text-ash text-[13px] font-semibold">Reservas</div>
            <div className="text-bone mt-2 text-2xl font-bold">
              Ver reservas →
            </div>
            <div className="text-ash mt-1 text-[12.5px]">
              gestioná reservas y cupos por salida
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`${basePath}/agency/rates`}
            className="text-onyx rounded-[10px] px-4 py-2.5 text-sm font-semibold"
            style={{
              background: "var(--admin-primary, rgb(var(--rgb-bone)))",
            }}
          >
            + Nueva tarifa
          </Link>
          <Link
            href={`${basePath}/site/content`}
            className="border-stone text-bone rounded-[10px] border px-4 py-2.5 text-sm font-semibold"
          >
            Editar contenido del sitio
          </Link>
        </div>

        <section className="bg-marble border-stone/60 overflow-hidden rounded-[14px] border shadow-[0_10px_26px_rgba(20,48,56,0.07)]">
          <h2
            className="px-5 pt-4 pb-3 text-base font-semibold"
            style={{
              fontFamily: "var(--admin-heading-font, inherit)",
              color: "var(--admin-heading-color, inherit)",
            }}
          >
            Excursiones y tarifas vigentes
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ash border-stone/60 border-b text-left text-xs">
                <th className="px-5 py-2 font-semibold">Excursión</th>
                <th className="px-5 py-2 font-semibold">Tarifa vigente</th>
                <th className="px-5 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {excursions.map((e) => {
                const price = rateByExc.get(e.id);
                return (
                  <tr
                    key={e.id}
                    className="border-stone/30 border-b last:border-0"
                  >
                    <td className="text-bone px-5 py-3">{e.name}</td>
                    <td className="text-bone px-5 py-3 font-semibold">
                      {price != null ? (
                        fmtARS.format(price)
                      ) : (
                        <span className="text-ash font-normal">sin tarifa</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {e.active ? (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                          style={{
                            color: "var(--badge-ok-text, #6ee7b7)",
                            background:
                              "var(--badge-ok-bg, rgba(6,95,70,0.35))",
                          }}
                        >
                          Activa
                        </span>
                      ) : (
                        <span className="bg-stone/40 text-ash rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold">
                          Pausada
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  // ------ Vista previa (tenants sin catálogo, p. ej. eventos): SIN CAMBIOS ------
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ count: leadsCount }, { data: latestLeads }, { data: sub }] =
    await Promise.all([
      sb
        .from("leads_tenant")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", since),
      sb
        .from("leads_tenant")
        .select("name,email,phone,created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("subscriptions")
        .select("plan_key,status,current_period_end")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
    ]);

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Hola, {user.email}</h1>
        <p className="text-ash text-sm">
          Tu sitio:{" "}
          <a
            className="underline"
            href={siteUrl(tenant.slug)}
            target="_blank"
            rel="noreferrer"
          >
            {siteHostLabel(tenant.slug, tenant.custom_domain)} ↗
          </a>
        </p>
      </header>

      {isDraft && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-600 bg-yellow-900/20 p-4">
          <span>⚠️ Tu sitio está en borrador.</span>
          <Link href={`${basePath}/site/content`} className="underline">
            Editar y publicar →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Leads (30d)" value={String(leadsCount ?? 0)} />
        <Card label="Plan" value={sub?.plan_key ?? "—"} />
        <Card label="Status" value={sub?.status ?? "trial"} />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Últimos leads</h2>
        <div className="bg-marble overflow-hidden rounded-lg">
          {(latestLeads ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (l: any, i: number) => (
              <div
                key={i}
                className="border-stone flex justify-between border-b px-4 py-3 text-sm last:border-0"
              >
                <span>{l.name}</span>
                <span className="text-ash">
                  {new Date(l.created_at).toLocaleString("es-AR")}
                </span>
              </div>
            ),
          )}
          {(!latestLeads || latestLeads.length === 0) && (
            <p className="text-ash p-4 text-sm">Aún no recibiste leads.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-marble rounded-lg p-4">
      <div className="text-ash text-xs tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
