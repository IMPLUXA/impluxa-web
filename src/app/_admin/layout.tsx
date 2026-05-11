import { requireAdmin } from "@/lib/auth/guard";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="bg-onyx text-bone min-h-screen">
      <header className="border-stone flex items-center gap-6 border-b px-6 py-4">
        <span className="font-serif text-xl">IMPLUXA · admin</span>
        <Link href="/tenants" className="hover:text-cream text-sm">
          Tenants
        </Link>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
