import Link from "next/link";
import type { Tenant } from "@/lib/tenants/types";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/site/content", label: "Contenido", icon: "✏️" },
  { href: "/site/design", label: "Diseño", icon: "🎨" },
  { href: "/site/media", label: "Imágenes", icon: "🖼️" },
  { href: "/leads", label: "Leads", icon: "📬" },
  { href: "/billing", label: "Facturación", icon: "💳" },
];

export function Sidebar({
  tenant,
}: {
  tenant: Tenant;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-marble border-stone fixed top-0 left-0 z-30 hidden h-screen w-64 flex-col border-r p-6 md:flex">
        <div className="mb-8 font-serif text-2xl">IMPLUXA</div>
        <div className="text-ash mb-1 text-sm">{tenant.name}</div>
        <div className="text-ash mb-6 text-xs">{tenant.slug}.impluxa.com</div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hover:bg-stone/40 flex items-center gap-3 rounded px-3 py-2"
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <a
          href={`https://${tenant.slug}.impluxa.com`}
          target="_blank"
          rel="noreferrer"
          className="text-bone mt-4 text-xs underline"
        >
          Ver sitio ↗
        </a>
      </aside>

      {/* Mobile bottom-nav */}
      <nav className="bg-marble border-stone fixed right-0 bottom-0 left-0 z-30 border-t p-2 md:hidden">
        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          {NAV.slice(0, 5).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center py-1"
            >
              <span className="text-lg">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
