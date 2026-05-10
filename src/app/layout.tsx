import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "IMPLUXA — Infraestructura para los negocios del mañana",
  description:
    "Digitalizá tu negocio con un SaaS modular: landing, reservas, pagos, chatbot IA y más.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-LA"
      className={`${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <Nav />
        <main className="pt-20">{children}</main>
      </body>
    </html>
  );
}
