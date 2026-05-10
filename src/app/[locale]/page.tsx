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
