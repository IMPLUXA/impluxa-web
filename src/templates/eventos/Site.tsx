import { Hero } from "./components/Hero";
import { AboutStrip } from "./components/AboutStrip";
import { Servicios } from "./components/Servicios";
import { Combos } from "./components/Combos";
import { Calendar } from "./components/Calendar";
import { Testimonios } from "./components/Testimonios";
import { Pautas } from "./components/Pautas";
import { Contacto } from "./components/Contacto";
import { Footer } from "./components/Footer";
import type { EventosContent, EventosDesign, EventosMedia } from "./schema";

export interface EventosSiteProps {
  content: EventosContent;
  design: EventosDesign;
  media: EventosMedia;
  tenantId: string;
  tenantName: string;
}

export function EventosSite({
  content,
  design,
  media,
  tenantId,
  tenantName,
}: EventosSiteProps) {
  return (
    <div
      style={{
        background: design.colors.background,
        color: design.colors.text,
      }}
    >
      <Hero content={content.hero} design={design} media={media} />
      <AboutStrip content={content.about} design={design} />
      <Servicios items={content.servicios} design={design} />
      <Combos items={content.combos} design={design} />
      <Calendar design={design} />
      <Testimonios items={content.testimonios} design={design} />
      <Pautas items={content.pautas} design={design} />
      <Contacto
        content={content.contacto}
        design={design}
        tenantId={tenantId}
      />
      <Footer design={design} tenantName={tenantName} />
    </div>
  );
}
