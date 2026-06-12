import Link from "next/link";
import type { Tenant } from "@/lib/tenants/types";
import type { TenantBranding } from "@/lib/tenants/login-branding";
import { sidebarGradient } from "@/lib/tenants/admin-tokens";
import { siteUrl, siteHostLabel } from "@/lib/urls";
import {
  House,
  Mountains,
  CurrencyCircleDollar,
  Handshake,
  PencilSimpleLine,
  CalendarCheck,
  Ticket,
  ChatCircleText,
  ArrowSquareOut,
  Wallet,
  SquaresFour,
  CreditCard,
  LockSimple,
} from "@phosphor-icons/react/dist/ssr";
import type { AgencyRole } from "@/lib/agency/role";
import { isAgencyOwner } from "@/lib/agency/role";
import { MoreSheet } from "@/components/app/MoreSheet";

// B-Fase1 (plan-fases-arquitectura-2capas-s46, adelantada por decisión CEO
// s49): el nav se parte en DOS CAPAS conceptuales sin mover nada de host
// (eso es Fase 2): operativo del tenant (lo que la agencia usa a diario) vs
// SaaS Impluxa (la relación cliente↔plataforma: plan, facturación).
// Los stubs sin página (`soon`) dejan de ser links 404eables (punch-list B6)
// y se muestran deshabilitados con badge "pronto".
//
// F-UI-BRANDED corte 2: prop `branding` opcional. CON branding renderiza el
// shell del mockup congelado v2.1 (sidebar con paleta/logo del tenant, nav
// v2.1-lite: los stubs sueltos Diseño/Imágenes y la sección "Tu cuenta
// Impluxa" NO aparecen — vuelven en corte 3/4 como Módulos + sección
// dueño-only; Leads pasa a llamarse Consultas). SIN branding renderiza
// EXACTAMENTE el markup previo — /app no cambia un byte de render.

type NavItem = { href: string; label: string; icon: string; soon?: boolean };

// Capa 1 — operativo del tenant. En Fase 2 esta capa se sirve branded bajo
// el dominio del cliente (/tenant/[slug]/admin).
const NAV_OPERATIVO: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/agency/excursions", label: "Excursiones", icon: "🏔️" },
  { href: "/agency/rates", label: "Tarifas", icon: "💰" },
  { href: "/agency/providers", label: "Proveedores", icon: "🤝" },
  { href: "/site/content", label: "Contenido", icon: "✏️" },
  // R1: VIVA pero DESPUÉS de Contenido a propósito — NAV_MOBILE corta en los
  // primeros 5 vivos y el bottom-nav actual queda idéntico (Salidas =
  // desktop-only v1; el slot mobile es el TODO(B-Fase2+) de abajo).
  { href: "/agency/departures", label: "Salidas", icon: "📅" },
  // R3: ídem Salidas — post-Contenido, fuera del slice mobile de 5.
  { href: "/agency/reservas", label: "Reservas", icon: "🎟️" },
  { href: "/site/design", label: "Diseño", icon: "🎨", soon: true },
  { href: "/site/media", label: "Imágenes", icon: "🖼️", soon: true },
  { href: "/leads", label: "Leads", icon: "📬", soon: true },
];

// Capa 2 — SaaS Impluxa. Queda en app.impluxa.com también post-Fase-2.
// TODO(billing-live): cuando /billing pierda `soon`, bajo el árbol admin el
// href debe ser URL ABSOLUTA al app host (https://app.impluxa.com/billing) —
// con basePath relativo daría /admin/billing → 404 (Pass-2 B-Fase2).
const NAV_SAAS: NavItem[] = [
  { href: "/billing", label: "Plan y facturación", icon: "💳", soon: true },
];

// Mobile bottom-nav: solo páginas operativas VIVAS (sin stubs).
// TODO(B-Fase2+): cuando un stub pierda `soon`, este slice trunca SILENCIOSO
// a 5 y grid-cols-5 queda corto — revisar selección mobile al sumar páginas.
const NAV_MOBILE = NAV_OPERATIVO.filter((n) => !n.soon).slice(0, 5);

// Nav del shell BRANDED (mockup v2.1). Ícono = componente Phosphor.
// MATRIZ DE ROLES v2.1 (corte 3): el bloque OPERATIVO lo ven TODOS los roles;
// el bloque DUEÑO (Finanzas + Módulos) y la sección "Tu cuenta Impluxa" SOLO
// dueno_admin. La visibilidad NO es la autoridad — la da el guard server-side
// (requireAgencyOwner) + la RLS; esto es la capa UI que la espeja.
type BrandedNavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  soon?: boolean;
  ownerOnly?: boolean;
};

// Operativo/logística: todos los roles.
const NAV_BRANDED: BrandedNavItem[] = [
  { href: "/dashboard", label: "Inicio", Icon: House },
  { href: "/agency/excursions", label: "Excursiones", Icon: Mountains },
  { href: "/agency/rates", label: "Tarifas", Icon: CurrencyCircleDollar },
  { href: "/agency/providers", label: "Proveedores", Icon: Handshake },
  { href: "/site/content", label: "Contenido", Icon: PencilSimpleLine },
  // R1: posición post-Contenido = NAV_BRANDED_MOBILE (primeros 5 vivos)
  // intacto; Salidas desktop-only v1 (ver TODO mobile en NAV_OPERATIVO).
  { href: "/agency/departures", label: "Salidas", Icon: CalendarCheck },
  // R3: ídem Salidas — bottom-nav branded intacto (primeros 5 vivos).
  { href: "/agency/reservas", label: "Reservas", Icon: Ticket },
  { href: "/leads", label: "Consultas", Icon: ChatCircleText, soon: true },
];

// Dueño-only, dentro del bloque "Tu agencia". Ambas son rutas REALES con
// guard e10 en la page base (Finanzas C3, Módulos C4).
const NAV_BRANDED_OWNER: BrandedNavItem[] = [
  { href: "/finanzas", label: "Finanzas", Icon: Wallet, ownerOnly: true },
  { href: "/modulos", label: "Módulos", Icon: SquaresFour, ownerOnly: true },
];

// Dueño-only, sección "Tu cuenta Impluxa" (la relación con la plataforma).
const NAV_BRANDED_ACCOUNT: BrandedNavItem[] = [
  {
    href: "/billing",
    label: "Plan y facturación",
    Icon: CreditCard,
    soon: true,
  },
];

// Mobile bottom-nav: SOLO operativo vivo (todos los roles). Los items
// dueño-only NO entran al bottom-nav en corte 3 — PROPUESTA al CEO: 6to slot
// "Más" que abre un sheet con Finanzas/Módulos/Tu cuenta (decide el CEO).
const NAV_BRANDED_MOBILE = NAV_BRANDED.filter((n) => !n.soon).slice(0, 5);

// basePath (B-Fase2): "" en app.impluxa.com (árbol /app) | "/admin" en el
// dominio del cliente (árbol /tenant/[slug]/admin). Los hrefs son EXTERNOS
// relativos al host — el middleware los rewritea; NUNCA /tenant/slug/... acá.
function NavEntry({ item, basePath }: { item: NavItem; basePath: string }) {
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
      href={`${basePath}${item.href}`}
      className="hover:bg-stone/40 flex items-center gap-3 rounded px-3 py-2"
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

function BrandedNavEntry({
  item,
  basePath,
  mutedColor,
  badgeStyle,
  ownerBadgeStyle,
}: {
  item: BrandedNavItem;
  basePath: string;
  mutedColor: string;
  badgeStyle: React.CSSProperties;
  ownerBadgeStyle: React.CSSProperties;
}) {
  const { Icon } = item;
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title="Próximamente"
        className="flex cursor-default items-center gap-3 rounded-[9px] px-3 py-2 text-sm font-medium"
        style={{ color: mutedColor }}
      >
        <Icon size={18} />
        <span>{item.label}</span>
        {/* soon + ownerOnly muestran AMBOS badges (Pass-2 CR: la rama soon
            ignoraba ownerOnly — inconsistencia visual para el dueño). */}
        {item.ownerOnly && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold"
            style={ownerBadgeStyle}
          >
            <LockSimple size={10} />
            solo dueño
          </span>
        )}
        <span
          className={
            item.ownerOnly
              ? "rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
              : "ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
          }
          style={badgeStyle}
        >
          pronto
        </span>
      </span>
    );
  }
  return (
    <Link
      href={`${basePath}${item.href}`}
      className="flex items-center gap-3 rounded-[9px] px-3 py-2 text-sm font-medium hover:bg-white/5"
    >
      <Icon size={18} />
      <span>{item.label}</span>
      {item.ownerOnly && (
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold"
          style={ownerBadgeStyle}
        >
          <LockSimple size={10} />
          solo dueño
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  tenant,
  basePath = "",
  branding = null,
  role = null,
}: {
  tenant: Tenant;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  basePath?: "" | "/admin";
  branding?: TenantBranding | null;
  role?: AgencyRole;
}) {
  if (branding) {
    // MATRIZ DE ROLES (corte 3): dueño ve los bloques dueño-only; cualquier
    // otro rol (o null = fail-closed) ve SOLO el operativo. La autoridad real
    // es el guard server-side + RLS; esto es la capa UI.
    const owner = isAgencyOwner(role);
    const primary = branding.colors.primary ?? "#1f2937";
    const background = branding.colors.background ?? "#f5f5f4";
    const accent = branding.colors.accent ?? background;
    const gradient = sidebarGradient(primary) ?? primary;
    // texto del sidebar: el cream del tenant, apenas apagado (mockup #E7DEC9)
    const sideText = `color-mix(in srgb, ${background} 88%, ${primary})`;
    // alphas del mockup v2.1 (Pass-2 UI): host .65 / labels .58 / wordmark .35
    const hostColor = `color-mix(in srgb, ${background} 65%, transparent)`;
    const sideMuted = `color-mix(in srgb, ${background} 58%, transparent)`;
    const accentSoft = `color-mix(in srgb, ${accent} 55%, white)`;
    const badgeStyle: React.CSSProperties = {
      background: `color-mix(in srgb, ${accent} 24%, transparent)`,
      color: accentSoft,
      letterSpacing: "0.04em",
    };
    const ownerBadgeStyle: React.CSSProperties = {
      borderColor: `color-mix(in srgb, ${accent} 50%, transparent)`,
      color: accentSoft,
      letterSpacing: "0.04em",
    };

    return (
      <>
        {/* Desktop sidebar branded */}
        <aside
          className="fixed top-0 left-0 z-30 hidden h-screen w-64 flex-col p-[18px] pt-[26px] md:flex"
          style={{ background: gradient, color: sideText }}
        >
          <div className="px-2">
            {branding.logoDarkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoDarkUrl}
                alt={branding.tenantName}
                className="h-[52px] w-auto"
              />
            ) : (
              <div className="text-xl font-semibold">{branding.tenantName}</div>
            )}
          </div>
          <div
            className="px-2 pt-2.5 text-[11.5px]"
            style={{ color: hostColor }}
          >
            {branding.hostLabel}
          </div>

          <div
            className="mt-6 mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: sideMuted }}
          >
            Tu agencia
          </div>
          <nav className="space-y-0.5">
            {NAV_BRANDED.map((n) => (
              <BrandedNavEntry
                key={n.href}
                item={n}
                basePath={basePath}
                mutedColor={sideMuted}
                badgeStyle={badgeStyle}
                ownerBadgeStyle={ownerBadgeStyle}
              />
            ))}
            {/* Bloque dueño-only dentro de "Tu agencia" */}
            {owner &&
              NAV_BRANDED_OWNER.map((n) => (
                <BrandedNavEntry
                  key={n.href}
                  item={n}
                  basePath={basePath}
                  mutedColor={sideMuted}
                  badgeStyle={badgeStyle}
                  ownerBadgeStyle={ownerBadgeStyle}
                />
              ))}
          </nav>

          {/* Sección "Tu cuenta Impluxa" — dueño-only (la relación con la
              plataforma; datos sensibles no son para empleados). */}
          {owner && (
            <>
              <div
                className="mt-6 mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] uppercase"
                style={{ color: sideMuted }}
              >
                Tu cuenta Impluxa
              </div>
              <nav className="space-y-0.5">
                {NAV_BRANDED_ACCOUNT.map((n) => (
                  <BrandedNavEntry
                    key={n.href}
                    item={n}
                    basePath={basePath}
                    mutedColor={sideMuted}
                    badgeStyle={badgeStyle}
                    ownerBadgeStyle={ownerBadgeStyle}
                  />
                ))}
              </nav>
            </>
          )}

          <div className="flex-1" />
          <a
            href={siteUrl(tenant.slug)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold hover:bg-white/5"
            style={{ color: accentSoft }}
          >
            <ArrowSquareOut size={18} />
            Ver sitio
          </a>
          <div
            className="mt-2.5 border-t px-3 pt-3 text-[11px] font-semibold tracking-[0.06em]"
            style={{
              color: `color-mix(in srgb, ${background} 35%, transparent)`,
              borderColor: `color-mix(in srgb, ${background} 12%, transparent)`,
            }}
          >
            IMPLUXA
          </div>
        </aside>

        {/* Mobile bottom-nav branded: 5 operativas vivas para TODOS los roles;
            el dueño suma el 6º slot "Más" (sheet con Finanzas/Módulos/Tu cuenta
            — decisión CEO s50; un no-dueño no recibe ni el botón). */}
        <nav
          className={`fixed right-0 bottom-0 left-0 z-30 grid ${owner ? "grid-cols-6" : "grid-cols-5"} gap-1 px-1 pt-2 pb-2.5 md:hidden`}
          style={{
            background: primary,
            borderTop: `1px solid color-mix(in srgb, ${background} 14%, transparent)`,
          }}
        >
          {NAV_BRANDED_MOBILE.map((n) => {
            const { Icon } = n;
            return (
              <Link
                key={n.href}
                href={`${basePath}${n.href}`}
                className="flex flex-col items-center gap-0.5 py-0.5 text-[10.5px]"
                style={{
                  color: `color-mix(in srgb, ${background} 75%, transparent)`,
                }}
              >
                <Icon size={20} />
                <span>{n.label}</span>
              </Link>
            );
          })}
          {owner && (
            <MoreSheet
              basePath={basePath}
              primary={primary}
              background={background}
            />
          )}
        </nav>
      </>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-marble border-stone fixed top-0 left-0 z-30 hidden h-screen w-64 flex-col border-r p-6 md:flex">
        <div className="mb-8 font-serif text-2xl">IMPLUXA</div>
        <div className="text-ash mb-1 text-sm">{tenant.name}</div>
        <div className="text-ash mb-6 text-xs">
          {siteHostLabel(tenant.slug)}
        </div>
        <nav className="flex-1">
          <div className="text-ash mb-2 px-3 text-[10px] tracking-widest uppercase">
            Tu agencia
          </div>
          <div className="space-y-1">
            {NAV_OPERATIVO.map((n) => (
              <NavEntry key={n.href} item={n} basePath={basePath} />
            ))}
          </div>
          <div className="border-stone/50 mt-6 border-t pt-4">
            <div className="text-ash mb-2 px-3 text-[10px] tracking-widest uppercase">
              Tu cuenta Impluxa
            </div>
            <div className="space-y-1">
              {NAV_SAAS.map((n) => (
                <NavEntry key={n.href} item={n} basePath={basePath} />
              ))}
            </div>
          </div>
        </nav>
        <a
          href={siteUrl(tenant.slug)}
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
              href={`${basePath}${n.href}`}
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
