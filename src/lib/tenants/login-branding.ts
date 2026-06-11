import "server-only";
import { cache } from "react";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { siteHostLabel } from "@/lib/urls";

// F-UI-BRANDED corte 1 — branding del /login por host (plan-f-ui-branded-s50).
// El /login es SHARED_ROOT (se sirve en todos los hosts sin rewrite): acá se
// decide si la pantalla se viste con la marca del tenant o queda genérica
// Impluxa. BRANDING-ONLY: no toca auth ni autoriza nada; la sesión y los datos
// siguen gateados por claim JWT + RLS.

export type LoginBranding = {
  tenantName: string;
  hostLabel: string;
  // hex validados (anti-inyección CSS: design_json es data del tenant y estos
  // valores terminan en un atributo style).
  colors: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    background: string | null;
    text: string | null;
  };
  logoDarkUrl: string | null;
  fonts: { heading: string | null; body: string | null };
};

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function hexOrNull(v: unknown): string | null {
  return typeof v === "string" && HEX_RE.test(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Solo URLs https con origin en el storage propio (host derivado de
// NEXT_PUBLIC_SUPABASE_URL): bloquea javascript:/data: Y origins externos —
// un logo_url_dark apuntado afuera filtraría IP/UA de visitantes del login a
// un tercero (Pass-2 SE corte 1).
function storageUrlOrNull(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;
    return u.host === new URL(supabaseUrl).host ? s : null;
  } catch {
    return null;
  }
}

/**
 * Branding del login para el slug derivado del host (lo deriva el caller UNA
 * vez con tenantSlugFromHost y lo pasa — evita la doble lectura implícita,
 * Pass-2 SE), o null → pantalla genérica Impluxa.
 * null en: hosts de plataforma (slug null), slug inexistente, y tenant NO
 * published (gate Pass-2 SE: espeja el 404 del sitio público
 * `tenant/[slug]/page.tsx:41` — un tenant draft/suspendido no revela branding
 * acá que su sitio público no revele; sin oráculo nuevo). Nota declarada: el
 * cache de resolveTenantBySlug (TTL 60s) hace que una despublicación tarde
 * hasta 60s en desvestir el login — espeja el sitio público, no es oráculo.
 */
export async function getLoginBranding(
  slug: string | null,
): Promise<LoginBranding | null> {
  if (!slug) return null;

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant || tenant.status !== "published") return null;

  return getTenantBranding(tenant);
}

// ---------------------------------------------------------------------------
// F-UI-BRANDED corte 2 — branding completo para el shell admin branded.
// Superset del LoginBranding: suma logo para fondos claros (topbar móvil) y
// favicon del panel. El admin NO exige published (el dueño autenticado de un
// tenant draft ve SU marca en SU panel — la autorización la dan e07-e09 +
// RLS, no este helper); el login público sí lo exige (gate de arriba).
// ---------------------------------------------------------------------------

export type TenantBranding = LoginBranding & {
  logoLightUrl: string | null;
  faviconUrl: string | null;
};

type TenantLike = { id: string; name: string; slug: string };

/**
 * Branding del tenant YA RESUELTO (el caller trae el tenant de su propio
 * guard — assertHostMatchesClaim en el admin, resolve+published en el login —
 * acá no se re-resuelve nada). Mínimo privilegio: SOLO columnas de branding;
 * raw read + guards de tipo (sin schema.parse: un throw acá rompería el
 * login/admin — mismo criterio que generateMetadata del sitio público).
 */
export const getTenantBranding = cache(async function getTenantBranding(
  tenant: TenantLike,
): Promise<TenantBranding | null> {
  // React.cache: en el subtree admin esto corre en generateMetadata Y en el
  // layout del mismo request — dedup per-request (Pass-2 CR corte 2). La
  // identidad del arg se sostiene porque resolveTenantBySlug cachea el objeto.
  const supabase = getSupabaseServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("design_json,media_json")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!site) return null;

  const design = (site.design_json ?? {}) as Record<string, unknown>;
  const media = (site.media_json ?? {}) as Record<string, unknown>;
  const colors = (design["colors"] ?? {}) as Record<string, unknown>;
  const fonts = (design["fonts"] ?? {}) as Record<string, unknown>;

  return {
    tenantName: tenant.name,
    hostLabel: siteHostLabel(tenant.slug),
    colors: {
      primary: hexOrNull(colors["primary"]),
      secondary: hexOrNull(colors["secondary"]),
      accent: hexOrNull(colors["accent"]),
      background: hexOrNull(colors["background"]),
      text: hexOrNull(colors["text"]),
    },
    logoDarkUrl: storageUrlOrNull(media["logo_url_dark"]),
    logoLightUrl: storageUrlOrNull(media["logo_url"]),
    faviconUrl: storageUrlOrNull(media["favicon_url"]),
    fonts: {
      heading: strOrNull(fonts["heading"]),
      body: strOrNull(fonts["body"]),
    },
  };
});
