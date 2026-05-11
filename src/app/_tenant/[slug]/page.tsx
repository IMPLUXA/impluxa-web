export default async function TenantRoot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main>
      <h1>Tenant: {slug}</h1>
    </main>
  );
}
