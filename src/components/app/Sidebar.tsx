import Link from "next/link";
import type { Tenant } from "@/lib/tenants/types";

// B-Fase1 (plan-fases-arquitectura-2capas-s46, adelantada por decisión CEO
// s49): el nav se parte en DOS CAPAS conceptuales sin mover nada de host
// (eso es Fase 2): operativo del tenant (lo que la agencia usa a diario) vs
// SaaS Impluxa (la relación cliente↔plataforma: plan, facturación).
// Los stubs sin página (`soon`) dejan de ser links 404eables (punch-list B6)
// y se muestran deshabilitados con badge "pronto".

type NavItem = { href: string; label: string; icon: string; soon?: boolean };

// Capa 1 — operativo del tenant. En Fase 2 esta capa se sirve branded bajo
// el dominio del cliente (/tenant/[slug]/admin).
const NAV_OPERATIVO: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/agency/excursions", label: "Excursiones", icon: "🏔️" },
  { href: "/agency/rates", label: "Tarifas", icon: "💰" },
  { href: "/agency/providers", label: "Proveedores", icon: "🤝" },
  { href: "/site/content", label: "Contenido", icon: "✏️" },
  { href: "/site/design", label: "Diseño", icon: "🎨", soon: true },
  { href: "/site/media", label: "Imágenes", icon: "🖼️", soon: true },
  { href: "/leads", label: "Leads", icon: "📬", soon: true },
];

// Capa 2 — SaaS Impluxa. Queda en app.impluxa.com también post-Fase-2.
const NAV_SAAS: NavItem[] = [
  { href: "/billing", label: "Plan y facturación", icon: "💳", soon: true },
];

// Mobile bottom-nav: solo páginas operativas VIVAS (sin stubs).
// TODO(B-Fase2+): cuando un stub pierda `soon`, este slice trunca SILENCIOSO
// a 5 y grid-cols-5 queda corto — revisar selección mobile al sumar páginas.
const NAV_MOBILE = NAV_OPERATIVO.filter((n) => !n.soon).slice(0, 5);

function NavEntry({ item }: { item: NavItem }) {
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title="Próximamente"
        className="text-ash flex cursor-default items-center gap-3 rounded px-3 py-2 opacity-60"
      >
        <span>{item.icon}</span>
        <span>{item.label}</span>
        <span className="bg-stone/40 ml-auto rounded-full px-2 py-0.5 text-[10px]">
          pronto
        </span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className="hover:bg-stone/40 flex items-center gap-3 rounded px-3 py-2"
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

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
        <nav className="flex-1">
          <div className="text-ash mb-2 px-3 text-[10px] tracking-widest uppercase">
            Tu agencia
          </div>
          <div className="space-y-1">
            {NAV_OPERATIVO.map((n) => (
              <NavEntry key={n.href} item={n} />
            ))}
          </div>
          <div className="border-stone/50 mt-6 border-t pt-4">
            <div className="text-ash mb-2 px-3 text-[10px] tracking-widest uppercase">
              Tu cuenta Impluxa
            </div>
            <div className="space-y-1">
              {NAV_SAAS.map((n) => (
                <NavEntry key={n.href} item={n} />
              ))}
            </div>
          </div>
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

      {/* Mobile bottom-nav (solo operativo vivo) */}
      <nav className="bg-marble border-stone fixed right-0 bottom-0 left-0 z-30 border-t p-2 md:hidden">
        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          {NAV_MOBILE.map((n) => (
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
