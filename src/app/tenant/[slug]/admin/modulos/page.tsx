import ModulosPage from "@/app/app/modulos/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper B-Fase2 (C4): host-vs-claim + render de la base. El guard dueño-only
// (requireAgencyOwner) vive DENTRO de ModulosPage (base) — corre por ambos
// hosts, no solo acá (mismo patrón que Finanzas).
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  return <ModulosPage />;
}
