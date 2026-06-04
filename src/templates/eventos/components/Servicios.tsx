import Image from "next/image";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
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

// s39 P1 — Detalle modal. Lazy + overlay-only (mismo patrón que ServicioGallery):
// solo se monta dentro del branch overlay cuando el servicio tiene `detalle`, así
// un tenant en "stack" (hakunamatata) nunca importa este JS chunk -> byte-idéntico.
const ServicioDetalle = dynamic(
  () =>
    import("./ServicioDetalle").then((m) => ({ default: m.ServicioDetalle })),
  { ssr: true },
);

type Servicio = EventosContent["servicios"][number];

// v3 overlay chip icons, mapped by tags index: 0 = duración (clock),
// 1 = ubicación (pin), 2 = dificultad (signal). Data order is controlled in
// content_json (turismo). Out-of-range falls back to the signal icon.
const CHIP_ICONS: ReactNode[] = [
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>,
  <path d="M3 20h18M7 20V10M12 20V4M17 20v-7" />,
];

// "Mes de lanzamiento" offer: launch (price_ars = charged) vs regular display
// (price_regular_ars). Show strike+badge ONLY when a real offer exists AND the
// discount clears the ~10% threshold (small discounts render a clean price).
function offerPct(s: {
  price_ars?: number;
  price_regular_ars?: number;
}): number {
  if (
    s.price_regular_ars == null ||
    s.price_ars == null ||
    s.price_regular_ars <= s.price_ars
  )
    return 0;
  return Math.round((1 - s.price_ars / s.price_regular_ars) * 100);
}

// s39 P1 — true si el servicio tiene al menos un campo de detalle con contenido.
// Gate de render del trigger/modal (content-gate). Un `detalle` ausente o {} vacío
// -> false -> no se monta ServicioDetalle (Hakuna no tiene detalle -> nunca true).
function hasDetalle(s: Servicio): boolean {
  const d = s.detalle;
  if (!d) return false;
  return Boolean(
    d.duracion ||
    d.dificultad ||
    d.punto_salida ||
    d.cancelacion ||
    (d.horarios && d.horarios.length) ||
    (d.itinerario && d.itinerario.length) ||
    (d.incluye && d.incluye.length) ||
    (d.no_incluye && d.no_incluye.length) ||
    (d.faqs && d.faqs.length),
  );
}

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

  // ----- v3 OVERLAY (turismo opt-in). Separate subtree from the byte-identical
  // stack path below. Hakuna / default tenants stay on "stack" -> identical. -----
  if (sc.serviciosLayout === "overlay") {
    const heading = design.fonts.heading;
    const anyOffer = items.some((s) => offerPct(s) >= 10);
    const [featured, ...rest] = items;

    const cover = (s: Servicio) =>
      s.gallery && s.gallery.length > 0 ? (
        <ServicioGallery
          images={s.gallery}
          cover={s.image_url ?? s.gallery[0]}
          title={s.title}
          design={design}
          overlay
        />
      ) : (
        s.image_url && (
          <Image
            src={s.image_url}
            alt={s.title}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        )
      );

    const chips = (s: Servicio) =>
      s.tags && s.tags.length > 0 ? (
        <ul className="exc-chips" role="list">
          {s.tags.map((t, i) => (
            <li key={`${s.key}-${i}`} className="exc-chip">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                {CHIP_ICONS[i] ?? CHIP_ICONS[2]}
              </svg>
              {t}
            </li>
          ))}
        </ul>
      ) : null;

    const priceBlock = (s: Servicio) => {
      if (s.price_ars == null) return null;
      const pct = offerPct(s);
      const show = pct >= 10;
      return (
        <div className="exc-pricewrap">
          <span className="exc-price">
            {show && (
              <span className="exc-reg">
                {arsPrice.format(s.price_regular_ars!)}
              </span>
            )}
            <span className="exc-amt" style={{ fontFamily: heading }}>
              {arsPrice.format(s.price_ars)}
            </span>
            {show && <span className="exc-off">-{pct}%</span>}
          </span>
          <span className="exc-per">por persona</span>
        </div>
      );
    };

    const ctaLink = (s: Servicio) => {
      const href = waCta
        ? `https://wa.me/${waCta}?text=${encodeURIComponent(
            `Hola! Quiero consultar por ${s.title}.`,
          )}`
        : "#contacto";
      return (
        <a
          className="exc-cta"
          href={href}
          {...(waCta && { target: "_blank", rel: "noopener noreferrer" })}
          aria-label={`Consultar por ${s.title}${waCta ? " por WhatsApp (se abre en una nueva pestaña)" : ""}`}
        >
          Consultar
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      );
    };

    return (
      <section
        id="servicios"
        aria-labelledby="servicios-heading"
        className="exc-sec"
      >
        <div className="exc-wrap">
          <header className="exc-head">
            <p className="exc-kicker">Bariloche y la comarca andina</p>
            <h2
              id="servicios-heading"
              className="exc-title"
              style={{ fontFamily: heading }}
            >
              Excursiones <em>de autor</em>
            </h2>
            <p className="exc-lead">
              Salidas en grupos reducidos por los clásicos de la región, con
              guías que nacieron y viven acá. Montaña, lago y bosque, contados
              por dentro.
            </p>
            {anyOffer && (
              <span className="exc-launch-pill">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  style={{ width: 14, height: 14, color: "#b48448" }}
                >
                  <path d="M12 2 15 9l7 .5-5.5 4.5L20 21l-8-4.5L4 21l1.5-7L0 9.5 7 9z" />
                </svg>
                Mes de lanzamiento · precios promocionales
              </span>
            )}
          </header>

          <ul className="exc-grid" role="list">
            {/* Featured (items[0]): photo + Pine panel (title NOT over photo). */}
            {featured && (
              <li key={featured.key}>
                <article
                  className="exc-card exc-card--feature"
                  aria-labelledby={`servicio-${featured.key}-title`}
                >
                  <div className="exc-photo">{cover(featured)}</div>
                  <div className="exc-feature-panel">
                    <span className="exc-feature-eyebrow">
                      El paseo más completo
                    </span>
                    <h3
                      id={`servicio-${featured.key}-title`}
                      style={{ fontFamily: heading }}
                    >
                      {featured.title}
                    </h3>
                    <p className="exc-desc">{featured.description}</p>
                    {chips(featured)}
                    <div className="exc-foot">
                      {priceBlock(featured)}
                      {ctaLink(featured)}
                    </div>
                    {hasDetalle(featured) && (
                      <ServicioDetalle
                        detalle={featured.detalle!}
                        title={featured.title}
                        cover={featured.image_url ?? featured.gallery?.[0]}
                        design={design}
                      />
                    )}
                  </div>
                </article>
              </li>
            )}

            {/* Remaining: photo-forward overlay cards. */}
            {rest.map((s) => (
              <li key={s.key}>
                <article
                  className="exc-card"
                  aria-labelledby={`servicio-${s.key}-title`}
                >
                  <div className="exc-photo">
                    {cover(s)}
                    <span className="exc-scrim" aria-hidden="true" />
                    <div className="exc-ovl">
                      <h3
                        id={`servicio-${s.key}-title`}
                        style={{ fontFamily: heading }}
                      >
                        {s.title}
                      </h3>
                      {s.gallery && s.gallery.length > 0 && (
                        <span className="exc-fotos">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <circle cx="9" cy="11" r="2" />
                            <path d="m21 17-5-5-9 7" />
                          </svg>
                          {s.gallery.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="exc-body">
                    <p className="exc-desc">{s.description}</p>
                    {chips(s)}
                    <div className="exc-foot">
                      {priceBlock(s)}
                      {ctaLink(s)}
                    </div>
                    {hasDetalle(s) && (
                      <ServicioDetalle
                        detalle={s.detalle!}
                        title={s.title}
                        cover={s.image_url ?? s.gallery?.[0]}
                        design={design}
                      />
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // ----- STACK (default) — BYTE-IDENTICAL to pre-v3 (Hakuna + any tenant
  // without the overlay opt-in). Do not modify. -----
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
