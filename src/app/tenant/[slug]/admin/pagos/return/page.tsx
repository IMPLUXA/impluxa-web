import CheckoutReturnPage from "@/app/app/pagos/return/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper host-aware (.ar) del retorno post-checkout MP (C-COBRO-MP C1). host-vs-claim +
// render de la base, reenviando searchParams (?r). El gate de sesión vive DENTRO de la base
// (corre por ambos hosts: app.impluxa.com/pagos/return y patagoniaviva.ar/admin/pagos/return).
// Espejo de admin/pagos/page.tsx.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  return <CheckoutReturnPage searchParams={searchParams} />;
}
