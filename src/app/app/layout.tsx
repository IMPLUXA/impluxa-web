import { requireUser } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/tenants/membership";
import { Sidebar } from "@/components/app/Sidebar";
import { redirect } from "next/navigation";

// Auth-gated route -- must be dynamic (uses cookies via Supabase SSR client).
// Without this, Next 16 throws "Page changed from static to dynamic at runtime".
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const tenant = await getCurrentTenant(user.id);
  if (!tenant) redirect("/login?error=no_tenant");

  return (
    <div className="bg-onyx text-bone flex min-h-screen">
      <Sidebar tenant={tenant} user={user} />
      <main className="flex-1 p-6 pb-24 md:ml-64 md:pb-6">{children}</main>
    </div>
  );
}
