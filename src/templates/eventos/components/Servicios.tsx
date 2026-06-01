import Image from "next/image";
import dynamic from "next/dynamic";
import type { EventosContent, EventosDesign } from "../schema";
import { resolveStructure } from "../structure";

const arsPrice = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

// Lazy: the lightbox is a "use client" chunk loaded ONLY when a servicio has a
// gallery. A tenant without galleries (hakunamatata) never imports this JS.
const ServicioGallery = dynamic(
  () =>
    import("./ServicioGallery").then((m) => ({ default: m.ServicioGallery })),
  { ssr: true },
);

export function Servicios({
  items,
  design,
  contacto,
}: {
  items: EventosContent["servicios"];
  design: EventosDesign;
  contacto?: EventosContent["contacto"];
}) {
  const sc = resolveStructure(design.structure);
  // WhatsApp "Consultar" CTA is OPT-IN via contacto.whatsapp_cta (NOT derived
  // from whatsapp presence — Hakuna has whatsapp too). Absent -> no button.
  const waCta =
    contacto?.whatsapp_cta === true && contacto.whatsapp
      ? contacto.whatsapp.replace(/[^0-9]/g, "")
      : null;
  const ctaColor = design.colors.cta ?? design.colors.primary;
  return (
    <section
      id="servicios"
      aria-labelledby="servicios-heading"
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        id="servicios-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Nuestros servicios
      </h2>
      <ul role="list" className={sc.serviciosGrid}>
        {items.map((s) => (
          <li key={s.key}>
            <article
              aria-labelledby={`servicio-${s.key}-title`}
              className={sc.card}
              style={{
                background: design.colors.secondary + "22",
                color: design.colors.text,
              }}
            >
              {s.gallery && s.gallery.length > 0 ? (
                <div className={sc.imageWrapper}>
                  <ServicioGallery
                    images={s.gallery}
                    cover={s.image_url ?? s.gallery[0]}
                    title={s.title}
                    design={design}
                  />
                </div>
              ) : (
                s.image_url && (
                  <div className={sc.imageWrapper}>
                    <Image
                      src={s.image_url}
                      alt={s.title}
                      fill
                      className={sc.imageFit}
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                )
              )}
              <div className={sc.cardPadding}>
                <h3
                  id={`servicio-${s.key}-title`}
                  className="mb-2 text-xl font-semibold"
                  style={{ fontFamily: design.fonts.heading }}
                >
                  {s.title}
                </h3>
                <p className="text-base">{s.description}</p>
                {s.tags && s.tags.length > 0 && (
                  <ul
                    role="list"
                    className="mt-3 flex list-none flex-wrap gap-2 p-0"
                  >
                    {s.tags.map((t) => (
                      <li
                        key={t}
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{
                          background: design.colors.accent + "22",
                          color: design.colors.primary,
                        }}
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                {s.price_ars != null && (
                  <p className="mt-3 text-sm font-medium opacity-80">
                    desde {arsPrice.format(s.price_ars)}
                  </p>
                )}
                {waCta && (
                  <a
                    href={`https://wa.me/${waCta}?text=${encodeURIComponent(
                      `Hola! Quiero consultar por ${s.title}.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Consultar por ${s.title} por WhatsApp (se abre en una nueva pestaña)`}
                    className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-2 font-semibold transition hover:scale-[1.02] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
                    style={{
                      background: ctaColor,
                      color: "#FFFFFF",
                      outlineColor: design.colors.accent,
                    }}
                  >
                    Consultar
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
