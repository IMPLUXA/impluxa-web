import RatesPage from "@/app/app/agency/rates/page";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";

// Wrapper B-Fase2 (C2): ver admin/page.tsx.
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertHostMatchesClaim(slug);
  return <RatesPage />;
}
