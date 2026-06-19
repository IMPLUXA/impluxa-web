import PagosPage from "@/app/app/pagos/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper B-Fase2: host-vs-claim + render de la base. El guard dueño-only
// (requireAgencyOwner) vive DENTRO de PagosPage (base) — corre por ambos hosts
// (app.impluxa.com y el branded .ar), no solo acá. Espejo de finanzas/page.tsx.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  return <PagosPage />;
}
