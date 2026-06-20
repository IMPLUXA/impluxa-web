import ReservaDetailPage from "@/app/app/agency/reservas/[id]/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper host-aware (.ar) del detalle de reserva (s59). host-vs-claim + render de la
// base reenviando el param id. El gate de sesion + RLS viven DENTRO de la base (corre
// por ambos hosts: app.impluxa.com/agency/reservas/<id> y
// patagoniaviva.ar/admin/agency/reservas/<id>). Espejo de admin/agency/reservas/page.tsx (C2).
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  await assertHostMatchesClaim(slug);
  return <ReservaDetailPage params={Promise.resolve({ id })} />;
}
