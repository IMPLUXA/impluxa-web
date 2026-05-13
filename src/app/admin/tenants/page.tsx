import Link from "next/link";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export default async function TenantsList() {
  const sb = getSupabaseServiceClient();
  const { data: tenants } = await sb
    .from("tenants")
    .select("id,slug,name,template_key,status,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants ({tenants?.length ?? 0})</h1>
        <Link
          href="/tenants/new"
          className="bg-bone text-onyx rounded px-4 py-2 font-semibold"
        >
          + Nuevo
        </Link>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ash text-left">
            <th className="py-2">Slug</th>
            <th>Nombre</th>
            <th>Template</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(tenants ?? []).map((t) => (
            <tr key={t.id} className="border-stone border-t">
              <td className="py-2">{t.slug}</td>
              <td>{t.name}</td>
              <td>{t.template_key}</td>
              <td>
                <span className="bg-marble rounded px-2 py-0.5">
                  {t.status}
                </span>
              </td>
              <td>
                <a
                  href={`https://${t.slug}.impluxa.com`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Ver ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
