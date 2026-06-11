import FinanzasPage from "@/app/app/finanzas/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper B-Fase2 (C3): host-vs-claim + render de la base. El guard dueño-only
// (requireAgencyOwner) vive DENTRO de FinanzasPage (base) — corre por ambos
// hosts (app.impluxa.com y el branded), no solo acá.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  return <FinanzasPage />;
}
