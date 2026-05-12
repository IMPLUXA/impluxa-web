/**
 * _tenant/[slug]/layout.tsx
 *
 * Shell layout for all tenant sites. Provides:
 * - <html lang="es"> for SEO
 * - next/font/google for Fredoka + Inter — self-hosted at build time,
 *   font-display: swap, zero render-blocking
 * - globals.css reset
 * - Plausible analytics (optional, env-gated)
 */
import type { ReactNode } from "react";
import { Fredoka, Inter } from "next/font/google";
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
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
