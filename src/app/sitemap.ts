import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const TENANT_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? ".impluxa.com";

// Marketing sitemap — served for every host EXCEPT a per-tenant branch below.
// Kept byte-identical to the previous static output so impluxa.com (and any
// tenant without its own branch, e.g. Hakuna) is unchanged.
const MARKETING_SITEMAP: MetadataRoute.Sitemap = [
  {
    url: "https://impluxa.com",
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages: { en: "https://impluxa.com/en" } },
  },
  { url: "https://impluxa.com/en", changeFrequency: "weekly", priority: 0.9 },
];

// Patagonia Viva — single-page tenant landing. Absolute LITERAL base: never
// reflect the request Host into emitted URLs (avoids cache-poisoning of the
// emitted canonical/sitemap URLs). Host is used only to SELECT this branch.
const PV_SITEMAP: MetadataRoute.Sitemap = [
  {
    url: "https://patagoniaviva.impluxa.com",
    changeFrequency: "weekly",
    priority: 1,
  },
];

// Patagonia Viva on its custom domain (DOMINIO-PV-1 fase B). Same page,
// .ar LITERALS — same anti-cache-poisoning principle: the Host only selects
// the branch, it is never reflected into emitted URLs.
const PV_AR_SITEMAP: MetadataRoute.Sitemap = [
  {
    url: "https://patagoniaviva.ar",
    changeFrequency: "weekly",
    priority: 1,
  },
];

// Host-aware: reading the request Host opts this route into per-request
// (dynamic) rendering. Allowlist-select — only an exact tenant slug match is
// served its own sitemap; every other host (impluxa.com, hakunamatata,
// www, localhost, unknown, spoofed) falls through to the unchanged MARKETING
// literal.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  // Exact custom-domain match first (allowlist, literal output).
  if (host === "patagoniaviva.ar") return PV_AR_SITEMAP;
  const slug = host.endsWith(TENANT_SUFFIX)
    ? host.slice(0, -TENANT_SUFFIX.length)
    : "";
  if (slug === "patagoniaviva") return PV_SITEMAP;
  return MARKETING_SITEMAP;
}
