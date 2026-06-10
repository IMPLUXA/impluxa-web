import Link from "next/link";
import { getAdminBasePath } from "@/lib/urls";

// Compartido por /app y /tenant/[slug]/admin (B-Fase2): el basePath se
// deriva del host del request (display/nav-only; autoridad = claim + RLS).
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const basePath = await getAdminBasePath();
  return (
    <div className="space-y-6">
      <nav className="border-stone flex gap-4 border-b">
        <Link
          href={`${basePath}/site/content`}
          className="hover:text-cream px-1 py-2"
        >
          Contenido
        </Link>
        <Link
          href={`${basePath}/site/design`}
          className="hover:text-cream px-1 py-2"
        >
          Diseño
        </Link>
        <Link
          href={`${basePath}/site/media`}
          className="hover:text-cream px-1 py-2"
        >
          Imágenes
        </Link>
        <Link
          href={`${basePath}/site/settings`}
          className="hover:text-cream px-1 py-2"
        >
          Ajustes
        </Link>
      </nav>
      {children}
    </div>
  );
}
