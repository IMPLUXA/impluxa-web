import { redirect } from "next/navigation";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper B-Fase2 (C2): host-vs-claim corre POR PAGE (el layout no re-corre
// en soft navigation; un switch de tenant en otra tab esquivaría el check).
// El root del admin redirige al dashboard (Pass-2: renderizar el stub de
// app.impluxa.com acá sería un leak de branding bajo el dominio del cliente).
// Path EXTERNO /admin/... — el middleware lo rewritea.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  redirect("/admin/dashboard");
}
