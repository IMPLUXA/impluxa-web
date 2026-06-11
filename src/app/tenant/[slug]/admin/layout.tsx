import type { Metadata } from "next";
import { Sidebar } from "@/components/app/Sidebar";
import { assertHostMatchesClaim } from "@/lib/auth/host-claim";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import { getTenantBranding } from "@/lib/tenants/login-branding";
import { buildAdminTokenStyle } from "@/lib/tenants/admin-tokens";
import { UserCircle } from "@phosphor-icons/react/dist/ssr";

// B-Fase2 — back-office servido bajo el dominio del cliente.
// El middleware ya rewritea {slug}.impluxa.com/admin/* → /tenant/{slug}/admin/*
// (sin cambios de middleware). Este layout es el shell del admin branded.
//
// F-UI-BRANDED corte 2: el shell se viste con la marca del tenant (mockup
// congelado v2.1). MECANISMO (bloqueante Pass-2 BA corregido): override de
// las 6 vars `--color-*` con valores rgb() YA RESUELTOS server-side en el
// wrapper del subtree — las utilities compiladas (`bg-onyx`, `text-bone`...)
// las leen por herencia y el área de contenido repinta a light-content sin
// tocar globals.css/tokens.css. El sidebar branded pinta con la paleta del
// tenant directo (no usa tokens). Si falta branding/colores → shell genérico
// (fail-open al look actual, nunca a medio pintar).
//
// force-dynamic: subtree auth-gated (cookies) — único export del subtree;
// los page wrappers NO lo repiten (el re-export no arrastra segment config,
// probado en build probe del BA).
export const dynamic = "force-dynamic";

// Fonts del tenant para el shell (Pass-2 UI corte 2): el root layout del árbol
// tenant ya emite las @font-face y deja las vars --font-* en <html> (FONTSETS
// estático); acá solo se CONSUMEN por nombre conocido del design_json. En
// /app esas vars no existen y nada de esto aplica (la page cae a inherit).
const FONT_VAR_BY_NAME: Record<string, string> = {
  Cinzel: "var(--font-cinzel), serif",
  "Hanken Grotesk": "var(--font-hanken), system-ui, sans-serif",
  Fredoka: "var(--font-fredoka), system-ui, sans-serif",
  Inter: "var(--font-inter), system-ui, sans-serif",
};

function fontVarOrNull(name: string | null): string | null {
  return name && Object.hasOwn(FONT_VAR_BY_NAME, name)
    ? FONT_VAR_BY_NAME[name]!
    : null;
}

// Favicon del panel (emit-when-present, mismo patrón que el sitio público:
// sin favicon_url el objeto queda vacío y sigue sirviendo el default global).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return {};
  const branding = await getTenantBranding(tenant);
  if (!branding?.faviconUrl) return {};
  return { icons: { icon: branding.faviconUrl } };
}

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // e07 → e08 → e09 (host-vs-claim fail-closed, sin auto-switch).
  const { user, tenant } = await assertHostMatchesClaim(slug);

  const branding = await getTenantBranding(tenant);
  const tokenStyle = branding ? buildAdminTokenStyle(branding.colors) : null;

  if (!branding || !tokenStyle) {
    // Shell genérico (look pre-corte-2): branding incompleto no rompe nada.
    return (
      <div className="bg-onyx text-bone flex min-h-screen">
        <Sidebar tenant={tenant} user={user} basePath="/admin" />
        <main className="flex-1 p-6 pb-24 md:ml-64 md:pb-6">{children}</main>
      </div>
    );
  }

  const bodyFont = fontVarOrNull(branding.fonts.body);
  const headingFont = fontVarOrNull(branding.fonts.heading);
  const wrapperStyle: Record<string, string> = {
    ...tokenStyle,
    // vars que las pages compartidas consumen con fallback inherit (en /app
    // no existen → la page queda exactamente como antes)
    ...(headingFont ? { "--admin-heading-font": headingFont } : {}),
    ...(branding.colors.primary
      ? {
          "--admin-heading-color": branding.colors.primary,
          "--admin-primary": branding.colors.primary,
        }
      : {}),
    ...(bodyFont ? { fontFamily: bodyFont } : {}),
  };

  return (
    <div
      className="bg-onyx text-bone flex min-h-screen"
      style={wrapperStyle as React.CSSProperties}
    >
      <Sidebar
        tenant={tenant}
        user={user}
        basePath="/admin"
        branding={branding}
      />
      <main className="flex-1 md:ml-64">
        <header className="border-stone/60 flex items-center justify-end border-b px-6 py-3.5 md:px-8">
          <div className="bg-marble border-stone/60 text-ash flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-2 text-[13.5px]">
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
              style={{
                background: branding.colors.primary ?? "#1f2937",
                color: branding.colors.background ?? "#f5f5f4",
              }}
            >
              <UserCircle size={18} />
            </span>
            Tu cuenta
          </div>
        </header>
        <div className="p-6 pb-24 md:p-8 md:pb-8">{children}</div>
      </main>
    </div>
  );
}
