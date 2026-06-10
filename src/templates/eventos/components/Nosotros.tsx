import Image from "next/image";
import type { EventosContent, EventosDesign } from "../schema";

/**
 * Nosotros (s48 F2b, turismo opt-in). Bloque 2-col del mockup v13: foto grande
 * a la izquierda, título + copy + CTA WhatsApp a la derecha, sección cálida
 * (#EFE5D0). OPT-IN: se monta SOLO cuando content_json.nosotros está presente
 * (Site.tsx lo renderiza condicional + null-guard acá). Hakuna no tiene
 * `nosotros` -> cero DOM -> byte-identical.
 *
 * El CTA usa el opt-in contacto.whatsapp_cta existente (NUNCA derivado de la
 * presencia de `whatsapp` — Hakuna también tiene whatsapp). Sin whatsapp_cta
 * el CTA apunta a #contacto.
 */
export function Nosotros({
  content,
  design,
  contacto,
}: {
  content?: EventosContent["nosotros"];
  design: EventosDesign;
  contacto?: EventosContent["contacto"];
}) {
  if (!content) return null;
  const waDigits =
    contacto?.whatsapp_cta === true && contacto.whatsapp
      ? contacto.whatsapp.replace(/[^0-9]/g, "")
      : null;
  const href = waDigits ? `https://wa.me/${waDigits}` : "#contacto";
  const label = content.cta_label ?? "Hablar con nosotros";
  return (
    <section
      id="nosotros"
      aria-labelledby="nosotros-heading"
      className="pv-nos-sec"
    >
      <div className="pv-nos-grid">
        <figure className="pv-nos-figure">
          <Image
            src={content.image_url}
            alt={content.image_alt ?? ""}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </figure>
        <div>
          <h2
            id="nosotros-heading"
            className="pv-nos-title"
            style={{ fontFamily: design.fonts.heading }}
          >
            {content.title}
          </h2>
          <p className="pv-nos-body">{content.body}</p>
          <a
            className="pv-nos-cta"
            href={href}
            {...(waDigits && { target: "_blank", rel: "noopener noreferrer" })}
            aria-label={
              waDigits
                ? `${label} por WhatsApp (se abre en una nueva pestaña)`
                : label
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ width: 18, height: 18 }}
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            {label}
          </a>
        </div>
      </div>
    </section>
  );
}
