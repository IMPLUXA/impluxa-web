import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Nav } from "@/components/nav";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL("https://impluxa.com"),
  title: { default: "IMPLUXA", template: "%s — IMPLUXA" },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number]))
    notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <Nav />
          <main id="contenido" className="pt-20">
            {children}
          </main>
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Impluxa",
              url: "https://impluxa.com",
              logo: "https://impluxa.com/icon.png",
              sameAs: ["https://github.com/IMPLUXA"],
            }),
          }}
        />
      </body>
    </html>
  );
}
