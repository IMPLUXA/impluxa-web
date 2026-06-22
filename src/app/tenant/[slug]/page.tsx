import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/tenants/resolve";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { applyCurrentRates, getPublicCurrentRates } from "@/lib/public/rates";
import {
  getPublicAvailability,
  getPublicReservaCategorias,
  type PublicDia,
  type PublicCategoria,
} from "@/lib/public/availability";
import { getTemplate } from "@/templates/registry";

export const revalidate = 60;

/**
 * Pre-render all published tenant slugs at build time.
 * Fallback (revalidate=60) handles new tenants after deploy.
 *
 * Wrapped in try/catch so the build still succeeds in environments
 * without live DB credentials (e.g. CI). New tenants are rendered
 * on demand via ISR.
 */
export async function generateStaticParams() {
  try {
    const { getSupabaseServiceClient: getSvc } =
      await import("@/lib/supabase/service");
    const supabase = getSvc();
    const { data, error } = await supabase
      .from("tenants")
      .select("slug")
      .eq("status", "published");
    if (error) return [];
    return (data ?? []).map((t: { slug: string }) => ({ slug: t.slug }));
  } catch {
    // No DB creds at build time (CI): defer all rendering to runtime ISR.
    return [];
  }
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant || tenant.status !== "published") notFound();

  const supabase = getSupabaseServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("content_json,design_json,media_json,seo_json")
    .eq("tenant_id", tenant.id)
    .single();

  const template = getTemplate(tenant.template_key);
  if (!template || !site) notFound();

  const rates = await getPublicCurrentRates(tenant.id);
  const content = applyCurrentRates(
    template.contentSchema.parse(site.content_json),
    rates,
  );
  const design = template.designSchema.parse(site.design_json);
  const media = template.mediaSchema.parse(site.media_json);

  // F2 — disponibilidad PÚBLICA per-excursion (server-side, ISR). Tenant del HOST (tenant.id),
  // NUNCA del cliente. Fail-closed: getPublicAvailability nunca lanza. Hakuna: servicios sin
  // excursion_id -> sin fetch -> availability {} -> el branch stack lo ignora (byte-idéntico).
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fromDate = new Date();
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 62);
  const servicios: Array<{ excursion_id?: string }> = content.servicios ?? [];
  const availPairs = await Promise.all(
    servicios
      .filter((s) => s.excursion_id)
      .map(
        async (s) =>
          [
            s.excursion_id as string,
            await getPublicAvailability(
              tenant.id,
              s.excursion_id as string,
              isoOf(fromDate),
              isoOf(toDate),
            ),
          ] as const,
      ),
  );
  const availability: Record<string, PublicDia[]> =
    Object.fromEntries(availPairs);

  // F3 — categorias de pasajero del tenant (para el desglose + total del modal de reserva). Gateado:
  // solo si el tenant tiene excursiones (Hakuna no -> [] sin query -> stack la ignora -> byte-idéntico).
  const hasExcursions = servicios.some((s) => s.excursion_id);
  const reservaCategorias: PublicCategoria[] = hasExcursions
    ? await getPublicReservaCategorias(tenant.id)
    : [];
  // F3 — Turnstile site key (PUBLICO) leido server-side con bracket-access (evita el falso positivo
  // del Sentinel; en server no hace falta el inlining estatico de las NEXT_PUBLIC).
  const turnstileSiteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Site = template.Site as React.ComponentType<any>;
  return (
    <Site
      content={content}
      design={design}
      media={media}
      tenantId={tenant.id}
      tenantName={tenant.name}
      availability={availability}
      reservaCategorias={reservaCategorias}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return {};

  const supabase = getSupabaseServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("seo_json,media_json")
    .eq("tenant_id", tenant.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seo = (site?.seo_json ?? {}) as Record<string, any>;
  const description: string =
    seo.description ?? `Sitio oficial de ${tenant.name}`;

  // Build the base metadata identical to before. `icons` is added ONLY when the
  // tenant has a media_json.favicon_url — tenants without it (e.g. Hakuna) return
  // the exact same object as before, so their <head> stays byte-identical and keeps
  // serving the global app/favicon.ico. Raw read + string guard (no schema.parse:
  // a strict parse throw here would break metadata for ALL tenants).
  const metadata: Metadata = {
    title: tenant.name,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title: tenant.name,
      description,
      type: "website",
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media = (site?.media_json ?? {}) as Record<string, any>;
  const faviconUrl = media.favicon_url;
  if (typeof faviconUrl === "string" && faviconUrl.length > 0) {
    // sizes="any" on the multi-res .ico wins the tab over the global 256x256
    // (emitted after the root link → also wins the browser tiebreaker).
    const appleUrl = faviconUrl.replace(/[^/]+$/, "apple-touch-180.png");
    metadata.icons = {
      icon: [{ url: faviconUrl, sizes: "any" }],
      apple: appleUrl,
    };
  }

  // SEO overrides — emitted ONLY when the tenant has the DEDICATED key, so
  // tenants without it keep a byte-identical <head>. Note Hakuna has a
  // `seo_json.title` (a DIFFERENT key) that stays intentionally ignored here:
  // we read `title_seo`, NOT `title`, precisely so activating PV's title does
  // not change Hakuna's served title. URLs are absolute (no metadataBase on
  // this route → relative canonical/og would not resolve).
  const titleSeo = seo.title_seo;
  if (typeof titleSeo === "string" && titleSeo.length > 0) {
    metadata.title = titleSeo;
    metadata.openGraph = { ...metadata.openGraph, title: titleSeo };
  }

  const canonicalUrl = seo.canonical_url;
  if (typeof canonicalUrl === "string" && canonicalUrl.length > 0) {
    metadata.alternates = { canonical: canonicalUrl };
    metadata.openGraph = { ...metadata.openGraph, url: canonicalUrl };
  }

  // OG image — inert until the tenant seeds `og_image_url` (fast-follow asset).
  // Hakuna lacks the key → no og:image, no twitter card → head unchanged.
  const ogImageUrl = seo.og_image_url;
  if (typeof ogImageUrl === "string" && ogImageUrl.length > 0) {
    metadata.openGraph = {
      ...metadata.openGraph,
      locale: "es_AR",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    };
    metadata.twitter = {
      card: "summary_large_image",
      title:
        typeof titleSeo === "string" && titleSeo.length > 0
          ? titleSeo
          : tenant.name,
      description,
      images: [ogImageUrl],
    };
  }

  return metadata;
}
