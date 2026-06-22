import dynamic from "next/dynamic";
import { Hero } from "./components/Hero";
import { AboutStrip } from "./components/AboutStrip";
import { Servicios } from "./components/Servicios";
import { Combos } from "./components/Combos";
import { Paseos } from "./components/Paseos";
import { Calendar } from "./components/Calendar";
import { Testimonios } from "./components/Testimonios";
import { Contacto } from "./components/Contacto";
import { Footer } from "./components/Footer";
import { TenantNav } from "./components/TenantNav";
import { Nosotros } from "./components/Nosotros";
import type { EventosContent, EventosDesign, EventosMedia } from "./schema";
import type { PublicDia, PublicCategoria } from "@/lib/public/availability";

// Dynamic import — Pautas is a "use client" accordion below the fold.
// Defers its JS from the initial bundle, reducing TBT on mobile.
const Pautas = dynamic(
  () => import("./components/Pautas").then((m) => ({ default: m.Pautas })),
  { ssr: true },
);

// s59 F4 — voucher on-site al volver de Mercado Pago (overlay-only). Se monta SOLO para tenants
// con reservas (gate abajo, igual que el modal) -> Hakuna nunca lo incluye -> byte-idéntico.
const ReservaReturn = dynamic(
  () =>
    import("./components/ReservaReturn").then((m) => ({
      default: m.ReservaReturn,
    })),
  { ssr: true },
);

export interface EventosSiteProps {
  content: EventosContent;
  design: EventosDesign;
  media: EventosMedia;
  tenantId: string;
  tenantName: string;
  // s59 F2 — disponibilidad pública per-excursion (server-rendered). Opcional: ausente/vacío
  // (Hakuna) -> Servicios stack la ignora -> byte-idéntico.
  availability?: Record<string, PublicDia[]>;
  // s59 F3 — categorias de pasajero del tenant (desglose + total del modal). Opcional: ausente/vacío
  // (Hakuna) -> el branch overlay no se monta para stack -> byte-idéntico.
  reservaCategorias?: PublicCategoria[];
  // s59 F3 — Turnstile site key (público) para el widget del paso Datos. SOLO overlay.
  turnstileSiteKey?: string;
}

export function EventosSite({
  content,
  design,
  media,
  tenantId,
  tenantName,
  availability,
  reservaCategorias,
  turnstileSiteKey,
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
      {content.nav && (
        <TenantNav
          items={content.nav.items}
          logoLight={media.logo_url_light}
          logoDark={media.logo_url_dark}
          tenantName={tenantName}
          whatsapp={content.contacto.whatsapp}
          whatsappCta={content.contacto.whatsapp_cta}
        />
      )}
      <main id="main-content" tabIndex={-1}>
        <Hero
          content={content.hero}
          design={design}
          media={media}
          tenantName={tenantName}
        />
        <AboutStrip content={content.about} design={design} />
        <Servicios
          items={content.servicios}
          design={design}
          contacto={content.contacto}
          availability={availability}
          reservaCategorias={reservaCategorias}
          turnstileSiteKey={turnstileSiteKey}
        />
        <Combos items={content.combos} design={design} />
        <Paseos items={content.paseos} design={design} />
        {/* s48 F2b — opt-in: ausente (Hakuna) no monta nada -> byte-identical */}
        {content.nosotros && (
          <Nosotros
            content={content.nosotros}
            design={design}
            contacto={content.contacto}
          />
        )}
        <Calendar design={design} />
        <Testimonios items={content.testimonios} design={design} />
        <Pautas items={content.pautas} design={design} />
        <Contacto
          content={content.contacto}
          design={design}
          tenantId={tenantId}
        />
      </main>
      <Footer
        design={design}
        tenantName={tenantName}
        whatsapp={content.contacto.whatsapp}
        whatsappCta={content.contacto.whatsapp_cta}
        instagram={content.contacto.instagram}
      />
      {content.contacto.whatsapp_cta === true && content.contacto.whatsapp && (
        <a
          href={`https://wa.me/${content.contacto.whatsapp.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          className="pv-anim-in fixed right-6 bottom-6 z-50 inline-flex min-h-[56px] min-w-[56px] items-center justify-center rounded-full shadow-lg transition hover:scale-105 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{
            background: "#25D366",
            color: "#FFFFFF",
            animationDelay: "0.6s",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-7 w-7"
            aria-hidden
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
          </svg>
        </a>
      )}
      {/* s59 F4 — voucher on-site del retorno MP. Gateado por availability (tenant con reservas):
          Hakuna (availability vacío) NO lo monta -> byte-idéntico. */}
      {availability && Object.keys(availability).length > 0 && (
        <ReservaReturn
          design={design}
          tenantName={tenantName}
          logoUrl={media.logo_url_dark ?? media.logo_url_light}
          address={content.contacto.address}
          phone={content.contacto.phone}
          waHref={
            content.contacto.whatsapp
              ? `https://wa.me/${content.contacto.whatsapp.replace(/[^0-9]/g, "")}`
              : null
          }
        />
      )}
    </div>
  );
}
