"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { HeroFallback } from "./hero-fallback";

const Hero3D = dynamic(() => import("./hero-3d").then((m) => m.Hero3D), {
  ssr: false,
  loading: () => <HeroFallback />,
});

export function Hero() {
  const t = useTranslations("hero");
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      {reducedMotion ? <HeroFallback /> : <Hero3D />}
      <div className="relative z-10 max-w-4xl text-center">
        <p className="text-ash mb-6 font-mono text-xs tracking-[0.3em] uppercase">
          {t("kicker")}
        </p>
        <h1 className="font-display text-bone text-6xl font-bold tracking-wider uppercase md:text-8xl lg:text-9xl">
          {t("title")}
        </h1>
        <p className="font-display text-bone/70 mt-8 text-xl italic md:text-2xl">
          {t("tagline")}
        </p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#contacto"
            className="bg-bone text-onyx hover:bg-cream rounded-md px-8 py-3 text-sm font-medium transition"
          >
            {t("ctaPrimary")}
          </a>
          <a
            href="#producto"
            className="text-bone/80 hover:text-bone text-sm transition"
          >
            {t("ctaSecondary")} →
          </a>
        </div>
      </div>
    </section>
  );
}
