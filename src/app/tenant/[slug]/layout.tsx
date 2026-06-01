/**
 * tenant/[slug]/layout.tsx
 *
 * Shell layout for all tenant sites. Provides:
 * - <html lang="es"> for SEO
 * - next/font/google self-hosted at build time, font-display: swap
 * - globals.css reset
 * - Plausible analytics (optional, env-gated)
 *
 * Tenant-aware fonts: all font objects are instantiated at module level (next/font
 * requires static top-level imports) and emit their @font-face with the REAL
 * family name (e.g. "Cinzel"), which the components reference via the literal
 * `design.fonts.*`. The <html> className is composed from a STATIC slug->fontset
 * map (no DB fetch in the layout). hakunamatata keeps EXACTLY `fredoka inter`
 * (same vars, same order, same hash) -> byte-identical; turismo gets cinzel+hanken.
 * Unknown slugs fall back to the original default (fredoka+inter).
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
  hakunamatata: `${fredoka.variable} ${inter.variable}`,
  turismo: `${cinzel.variable} ${hanken.variable}`,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fontVars = FONTSETS[slug] ?? DEFAULT_FONTS;
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
