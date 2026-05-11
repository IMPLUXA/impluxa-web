import Link from "next/link";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <nav className="border-stone flex gap-4 border-b">
        <Link href="/site/content" className="hover:text-cream px-1 py-2">
          Contenido
        </Link>
        <Link href="/site/design" className="hover:text-cream px-1 py-2">
          Diseño
        </Link>
        <Link href="/site/media" className="hover:text-cream px-1 py-2">
          Imágenes
        </Link>
        <Link href="/site/settings" className="hover:text-cream px-1 py-2">
          Ajustes
        </Link>
      </nav>
      {children}
    </div>
  );
}
