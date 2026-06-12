/**
 * tenant_domain/[domain]/layout.tsx
 *
 * Shell layout for tenant sites served on a CUSTOM DOMAIN (DOMINIO-PV-1
 * fase B). Mirror of tenant/[slug]/layout.tsx — layouts compose by route
 * segment, not by import, so the custom-domain tree needs its own shell:
 * - <html lang="es"> for SEO
 * - next/font/google self-hosted at build time, font-display: swap
 * - globals.css reset
 * - Plausible analytics (optional, env-gated)
 *
 * Fonts resolve from a STATIC domain->fontset map (no DB fetch in the
 * layout), mirror of the slug map. next/font requires module-level
 * instantiation per file, so the font objects are duplicated here on
 * purpose — the shared tenant/[slug]/layout.tsx is NOT touched (Hakuna
 * byte-identity invariant). Unknown domains fall back to the default
 * fontset, same policy as unknown slugs.
 */
import type { ReactNode } from "react";
import { Fredoka, Inter, Cinzel, Hanken_Grotesk } from "next/font/google";
import "../../globals.css";

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

const DEFAULT_FONTS = `${fredoka.variable} ${inter.variable}`;
const FONTSETS: Record<string, string> = {
  "patagoniaviva.ar": `${cinzel.variable} ${hanken.variable}`,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function TenantDomainLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  let host = "";
  try {
    host = decodeURIComponent(domain).toLowerCase();
  } catch {
    // Malformed encoding: keep host empty -> default fontset; the page
    // component is the one that 404s, the layout just renders the shell.
  }
  const fontVars = FONTSETS[host] ?? DEFAULT_FONTS;
  return (
    <html lang="es" className={fontVars}>
      <body>
        {children}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </body>
    </html>
  );
}
