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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:px-4 focus:py-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          background: design.colors.primary,
          color: design.colors.background,
          outlineColor: design.colors.accent,
        }}
      >
        Saltar al contenido principal
      </a>
      <main id="main-content" tabIndex={-1}>
        <Hero
          content={content.hero}
          design={design}
          media={media}
          tenantName={tenantName}
        />
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
      </main>
      <Footer design={design} tenantName={tenantName} />
    </div>
  );
}
