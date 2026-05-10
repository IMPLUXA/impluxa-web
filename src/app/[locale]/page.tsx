import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/hero/hero";
import { Problem } from "@/components/sections/problem";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Industries } from "@/components/sections/industries";
import { Modules } from "@/components/sections/modules";
import { WhyImpluxa } from "@/components/sections/why-impluxa";
import { PricingTeaser } from "@/components/sections/pricing-teaser";
import { FAQ } from "@/components/sections/faq";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/footer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hero" });
  return {
    title: "IMPLUXA — " + t("tagline"),
    description: t("tagline"),
    openGraph: {
      title: "IMPLUXA",
      description: t("tagline"),
      type: "website",
      url: locale === "en" ? "https://impluxa.com/en" : "https://impluxa.com",
      locale: locale === "en" ? "en_US" : "es_AR",
    },
    twitter: {
      card: "summary_large_image",
      title: "IMPLUXA",
      description: t("tagline"),
    },
    alternates: {
      canonical:
        locale === "en" ? "https://impluxa.com/en" : "https://impluxa.com",
      languages: {
        "es-LA": "https://impluxa.com",
        en: "https://impluxa.com/en",
      },
    },
  };
}

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Industries />
      <Modules />
      <WhyImpluxa />
      <PricingTeaser />
      <FAQ />
      <Contact />
      <Footer />
    </>
  );
}
