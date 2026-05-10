"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function Nav() {
  const t = useTranslations("nav");
  return (
    <nav className="border-stone/30 bg-onyx/80 fixed top-0 z-50 flex w-full items-center justify-between border-b px-6 py-4 backdrop-blur-md">
      <a
        href="#contenido"
        className="focus:bg-bone focus:text-onyx sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <Link
        href="/"
        className="font-display text-bone text-2xl font-bold tracking-wider"
        aria-label="Impluxa home"
      >
        IXA
      </Link>
      <div className="hidden items-center gap-8 md:flex">
        <a
          href="#producto"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          {t("product")}
        </a>
        <a
          href="#industrias"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          {t("industries")}
        </a>
        <a
          href="#precio"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          {t("pricing")}
        </a>
        <a
          href="#contacto"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          {t("contact")}
        </a>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-ash font-mono text-xs">ES | EN</span>
        <a
          href="#contacto"
          className="bg-bone text-onyx hover:bg-cream rounded-md px-4 py-2 text-sm font-medium transition"
        >
          {t("cta")}
        </a>
      </div>
    </nav>
  );
}
