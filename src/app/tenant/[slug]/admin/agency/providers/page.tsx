import ProvidersPage from "@/app/app/agency/providers/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper B-Fase2 (C2): ver admin/page.tsx.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  return <ProvidersPage />;
}
