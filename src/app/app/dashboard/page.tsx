import { requireUser } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import Link from "next/link";

export default async function Dashboard() {
  const user = await requireUser();
  const tenant = (await getCurrentTenant(user.id))!;
  const sb = getSupabaseServiceClient();

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

  const isDraft = tenant.status !== "published";

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Hola, {user.email}</h1>
        <p className="text-ash text-sm">
          Tu sitio:{" "}
          <a
            className="underline"
            href={`https://${tenant.slug}.impluxa.com`}
            target="_blank"
            rel="noreferrer"
          >
            {tenant.slug}.impluxa.com ↗
          </a>
        </p>
      </header>

      {isDraft && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-600 bg-yellow-900/20 p-4">
          <span>⚠️ Tu sitio está en borrador.</span>
          <Link href="/site/content" className="underline">
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
