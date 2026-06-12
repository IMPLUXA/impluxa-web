import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cinzel, Fredoka, Hanken_Grotesk, Inter } from "next/font/google";
import { getLoginBranding } from "@/lib/tenants/login-branding";
import { tenantSlugFromHost } from "@/lib/urls";
import { CUSTOM_DOMAIN_TENANTS } from "@/lib/tenants/custom-domain-map";
import { LoginForm } from "./LoginForm";

// F-UI-BRANDED corte 1 — /login branded por host (plan-f-ui-branded-s50).
// Server component: resuelve tenant por Host header y viste la pantalla con la
// marca del tenant (published-only, gate Pass-2 SE); en hosts de plataforma
// queda el genérico Impluxa. El REDIRECT post-login va por host (pedido a:
// en host de tenant → /admin/dashboard); el BRANDING va por host+published —
// dos decisiones separadas a propósito (un tenant draft igual loguea y cae al
// admin, solo que sin vestido).
//
// headers() (vía tenantSlugFromHost) fuerza render dinámico; explícito igual:
export const dynamic = "force-dynamic";

// Fonts conocidas de la plataforma (next/font exige instancias estáticas
// module-level — mismo patrón que el FONTSETS de tenant/[slug]/layout.tsx).
// El branding elige por NOMBRE desde design_json.fonts; nombre desconocido →
// fallback del sistema (el corte no se bloquea por una font nueva).
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const FONT_BY_NAME: Record<string, { variable: string; family: string }> = {
  Cinzel: { variable: cinzel.variable, family: `Cinzel, serif` },
  "Hanken Grotesk": {
    variable: hanken.variable,
    family: `"Hanken Grotesk", system-ui, sans-serif`,
  },
  Fredoka: {
    variable: fredoka.variable,
    family: `Fredoka, system-ui, sans-serif`,
  },
  Inter: { variable: inter.variable, family: `Inter, system-ui, sans-serif` },
};

// ADMIN-AR C4a (item v1.1 cruzado): el /login en un dominio custom es PUERTA
// REAL del admin (ya no "sin sesión útil") — noindex para que el login del
// dueño no aparezca en buscadores. Host-aware: SOLO los dominios custom del
// mapa emiten robots noindex; CUALQUIER otro host devuelve {} → metadata del
// /login byte-idéntica a hoy (Hakuna, app, marketing intactos). Object.hasOwn:
// espejo del fold C1/C2 (Host "__proto__" no hereda de Object.prototype).
export async function generateMetadata(): Promise<Metadata> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  if (Object.hasOwn(CUSTOM_DOMAIN_TENANTS, host)) {
    return { robots: { index: false, follow: false } };
  }
  return {};
}

export default async function LoginPage() {
  // Slug derivado UNA vez; redirect por host-only, branding por host+published.
  const slug = await tenantSlugFromHost();
  const branding = await getLoginBranding(slug);
  const postLoginPath = slug ? "/admin/dashboard" : "/";

  if (!branding) {
    // Genérico Impluxa: paridad visual con el login actual (solo que OTP-only).
    return (
      <main
        className="bg-onyx text-bone flex min-h-screen items-center justify-center p-6"
        style={
          {
            "--lg-heading": "var(--color-bone)",
            "--lg-text": "var(--color-bone)",
            "--lg-muted": "var(--color-ash)",
            "--lg-input-bg": "var(--color-marble)",
            "--lg-input-border": "var(--color-stone)",
            "--lg-btn-bg": "var(--color-bone)",
            "--lg-btn-text": "var(--color-onyx)",
            "--lg-btn-bg-hover": "var(--color-bone)",
            "--lg-accent": "var(--color-bone)",
            "--lg-focus-ring": "transparent",
          } as React.CSSProperties
        }
      >
        <div className="w-full max-w-sm space-y-4">
          <h1 className="font-serif text-2xl">Impluxa</h1>
          <LoginForm postLoginPath={postLoginPath} brandedTenantName={null} />
        </div>
      </main>
    );
  }

  const c = branding.colors;
  // Paleta con fallbacks neutros si algún hex falta en design_json (raro: el
  // helper ya validó formato; acá solo cubrimos ausencia).
  const primary = c.primary ?? "#1f2937";
  const background = c.background ?? "#f5f5f4";
  const text = c.text ?? "#1f2937";
  const accent = c.accent ?? primary;
  const secondary = c.secondary ?? primary;

  // Object.hasOwn: la clave viene de design_json (data del tenant) — un
  // lookup directo con "__proto__" devolvería Object.prototype (Pass-2 SE).
  const headingFont =
    branding.fonts.heading &&
    Object.hasOwn(FONT_BY_NAME, branding.fonts.heading)
      ? FONT_BY_NAME[branding.fonts.heading]
      : undefined;
  const bodyFont =
    branding.fonts.body && Object.hasOwn(FONT_BY_NAME, branding.fonts.body)
      ? FONT_BY_NAME[branding.fonts.body]
      : undefined;
  const fontVars = [headingFont?.variable, bodyFont?.variable]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center p-6 ${fontVars}`}
      style={
        {
          background: `radial-gradient(900px 600px at 18% -10%, color-mix(in srgb, ${secondary} 28%, transparent), transparent 60%), radial-gradient(700px 500px at 100% 110%, color-mix(in srgb, ${accent} 16%, transparent), transparent 55%), linear-gradient(160deg, ${primary} 0%, color-mix(in srgb, ${primary} 72%, black) 100%)`,
          fontFamily: bodyFont?.family,
          "--lg-heading": primary,
          "--lg-text": text,
          "--lg-muted": `color-mix(in srgb, ${text} 64%, white)`,
          "--lg-input-bg": "#fffef9",
          "--lg-input-border": `color-mix(in srgb, ${text} 24%, transparent)`,
          "--lg-btn-bg": primary,
          "--lg-btn-text": background,
          "--lg-btn-bg-hover": `color-mix(in srgb, ${primary} 86%, white)`,
          "--lg-accent": accent,
          "--lg-focus-ring": `color-mix(in srgb, ${accent} 24%, transparent)`,
        } as React.CSSProperties
      }
    >
      <div className="mb-7 flex flex-col items-center gap-2.5">
        {branding.logoDarkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoDarkUrl}
            alt={branding.tenantName}
            className="h-16 w-auto"
          />
        ) : (
          <div
            className="text-2xl font-semibold"
            style={{
              color: `color-mix(in srgb, ${background} 92%, transparent)`,
              fontFamily: headingFont?.family,
            }}
          >
            {branding.tenantName}
          </div>
        )}
        <div
          className="text-[12.5px]"
          style={{
            color: `color-mix(in srgb, ${background} 62%, transparent)`,
          }}
        >
          {branding.hostLabel}
        </div>
      </div>

      <div
        className="w-full max-w-[420px] rounded-[14px] border p-8 pb-7 shadow-2xl"
        style={{
          background,
          borderColor: `color-mix(in srgb, ${text} 8%, transparent)`,
        }}
      >
        <h1
          className="text-[22px] leading-tight font-bold"
          style={{ color: primary, fontFamily: headingFont?.family }}
        >
          Panel de Administración
        </h1>
        <p className="mt-1.5 mb-6 text-[14.5px] text-[var(--lg-muted)]">
          Acceso para el equipo de{" "}
          <span className="font-semibold text-[var(--lg-text)]">
            {branding.tenantName}
          </span>
        </p>
        <LoginForm
          postLoginPath={postLoginPath}
          brandedTenantName={branding.tenantName}
        />
      </div>

      <div
        className="mt-6 text-xs"
        style={{ color: `color-mix(in srgb, ${background} 52%, transparent)` }}
      >
        Con tecnología de Impluxa
      </div>
    </main>
  );
}
