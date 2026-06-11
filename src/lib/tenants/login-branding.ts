import "server-only";
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

  // Mínimo privilegio: SOLO columnas de branding; raw read + guards de tipo
  // (sin schema.parse: un throw acá rompería el login de TODOS los hosts —
  // mismo criterio que generateMetadata del sitio público).
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
    hostLabel: siteHostLabel(slug),
    colors: {
      primary: hexOrNull(colors["primary"]),
      secondary: hexOrNull(colors["secondary"]),
      accent: hexOrNull(colors["accent"]),
      background: hexOrNull(colors["background"]),
      text: hexOrNull(colors["text"]),
    },
    logoDarkUrl: storageUrlOrNull(media["logo_url_dark"]),
    fonts: {
      heading: strOrNull(fonts["heading"]),
      body: strOrNull(fonts["body"]),
    },
  };
}
