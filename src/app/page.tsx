import { Hero } from "@/components/hero/hero";
import { Problem } from "@/components/sections/problem";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Industries } from "@/components/sections/industries";
import { Modules } from "@/components/sections/modules";
import { WhyImpluxa } from "@/components/sections/why-impluxa";

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Industries />
      <Modules />
      <WhyImpluxa />
    </>
  );
}
