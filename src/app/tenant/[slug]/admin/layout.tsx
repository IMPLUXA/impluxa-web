import { Sidebar } from "@/components/app/Sidebar";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// B-Fase2 — back-office servido bajo el dominio del cliente.
// El middleware ya rewritea {slug}.impluxa.com/admin/* → /tenant/{slug}/admin/*
// (sin cambios de middleware). Este layout es el shell del admin branded:
// MISMO shell oscuro que /app (el html/body lo provee el root layout de
// tenant/[slug]; las fonts del tenant envuelven — aceptado en plan).
//
// force-dynamic: subtree auth-gated (cookies) — único export del subtree;
// los page wrappers NO lo repiten (el re-export no arrastra segment config,
// probado en build probe del BA).
export const dynamic = "force-dynamic";

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // e07 → e08 → e09 (host-vs-claim fail-closed, sin auto-switch).
  const { user, tenant } = await assertHostMatchesClaim(slug);

  return (
    <div className="bg-onyx text-bone flex min-h-screen">
      <Sidebar tenant={tenant} user={user} basePath="/admin" />
      <main className="flex-1 p-6 pb-24 md:ml-64 md:pb-6">{children}</main>
    </div>
  );
}
