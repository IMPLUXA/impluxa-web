import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const TENANT_SUFFIX =
  process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? ".impluxa.com";

// Host-aware: allowlist-select. Only an exact tenant slug match gets its own
// host-relative sitemap reference; every other host (impluxa.com, hakunamatata,
// www, localhost, unknown, spoofed) falls through to the unchanged literal so
// their robots.txt stays byte-identical to the previous static output.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  // Exact custom-domain match first (allowlist, literal output) —
  // DOMINIO-PV-1 fase B.
  if (host === "patagoniaviva.ar") {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://patagoniaviva.ar/sitemap.xml",
    };
  }
  const slug = host.endsWith(TENANT_SUFFIX)
    ? host.slice(0, -TENANT_SUFFIX.length)
    : "";
  if (slug === "patagoniaviva") {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://patagoniaviva.impluxa.com/sitemap.xml",
    };
  }
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://impluxa.com/sitemap.xml",
  };
}
