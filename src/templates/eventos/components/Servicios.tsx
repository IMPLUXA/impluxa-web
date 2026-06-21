import Image from "next/image";
import dynamic from "next/dynamic";
import type { EventosContent, EventosDesign } from "../schema";
import { resolveStructure } from "../structure";
import type { PublicDia } from "@/lib/public/availability";

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

// s48 F2b — Filtro de categorías (client island, overlay-only). Lazy dynamic:
// un tenant sin categorías (Hakuna / stack) nunca baja este chunk.
const ExcFilterChips = dynamic(
  () => import("./ExcFilterChips").then((m) => ({ default: m.ExcFilterChips })),
  { ssr: true },
);

// s59 F2 — modal de disponibilidad pública (overlay-only). Lazy dynamic: el branch stack
// (Hakuna) NUNCA importa este chunk -> byte-idéntico + sin JS extra.
const ReservaModal = dynamic(
  () => import("./ReservaModal").then((m) => ({ default: m.ReservaModal })),
  { ssr: true },
);

type Servicio = EventosContent["servicios"][number];

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
  availability,
}: {
  items: EventosContent["servicios"];
  design: EventosDesign;
  contacto?: EventosContent["contacto"];
  // s59 F2 — disponibilidad pública per-excursion (server-rendered, keyed by excursion_id).
  // SOLO la consume el branch overlay (turismo); el stack (Hakuna) la ignora -> byte-idéntico.
  availability?: Record<string, PublicDia[]>;
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
    // s40 — uniform 2-col grid: ALL services as same-size overlay cards (photo
    // 3:2 + scrim + title-over-photo + N-fotos badge, then body). No hero/
    // featured treatment. 2-col desktop -> 1-col mobile (.exc-grid).

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

    // s41 V3: banner de horario (lee detalle.horarios[0]). Parsea "main (dias)".
    const horario = (s: Servicio) => {
      const raw = s.detalle?.horarios?.[0];
      if (!raw) return null;
      const m = raw.match(/^([^(]+?)\s*(?:\(([^)]*)\))?$/);
      const main = (m?.[1] ?? raw).trim();
      const dias = m?.[2]?.trim();
      return (
        <div className="exc-horario">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span>
            Salida: {main}
            {dias && <span className="exc-horario-dias"> · {dias}</span>}
          </span>
        </div>
      );
    };

    // s41 V3: badge -% en la FOTO (movido desde el foot del precio).
    const offerBadge = (s: Servicio) => {
      if (s.price_ars == null) return null;
      const pct = offerPct(s);
      if (pct < 10) return null;
      return <span className="exc-off-photo">-{pct}%</span>;
    };

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
          </span>
          <span className="exc-per">por persona</span>
        </div>
      );
    };

    // s48 F2b — "Reservar" (mockup botones unificados: conversión marcada).
    // Mientras no exista flujo de reserva (F7), reserva = WhatsApp.
    const ctaLink = (s: Servicio) => {
      const href = waCta
        ? `https://wa.me/${waCta}?text=${encodeURIComponent(
            `Hola! Quiero reservar ${s.title}.`,
          )}`
        : "#contacto";
      return (
        <a
          className="exc-cta"
          href={href}
          {...(waCta && { target: "_blank", rel: "noopener noreferrer" })}
          aria-label={`Reservar ${s.title}${waCta ? " por WhatsApp (se abre en una nueva pestaña)" : ""}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Reservar
        </a>
      );
    };

    // s48 F2b — pills de foto (mockup): categoría arriba-izq + duración abajo-der.
    const CATLABEL: Record<string, string> = {
      terrestre: "Terrestre",
      lacustre: "Lacustre",
      aventura: "Aventura",
      nieve: "Nieve",
    };
    const catPill = (s: Servicio) =>
      s.category ? (
        <span className="exc-cat-pill">{CATLABEL[s.category]}</span>
      ) : null;
    const durPill = (s: Servicio) => {
      const dur = s.detalle?.duracion ?? s.tags?.[0];
      return dur ? <span className="exc-dur-pill">{dur}</span> : null;
    };

    // s48 F2b — filtro de categorías (solo si algún servicio trae category;
    // sin data -> sin chips -> render previo intacto).
    const hasCategories = items.some((s) => !!s.category);
    const counts: Record<string, number> = {
      todos: items.length,
      terrestre: 0,
      lacustre: 0,
      aventura: 0,
      nieve: 0,
    };
    for (const s of items) {
      if (s.category) counts[s.category] += 1;
    }
    // Empty-states del mockup v13 para categorías sin salidas aún.
    const EMPTIES: Record<string, [string, string]> = {
      lacustre: [
        "Excursiones lacustres",
        "Navegaciones por el Nahuel Huapi y Puerto Blest, próximamente.",
      ],
      aventura: ["Aventura", "Trekking, rafting y cabalgatas, próximamente."],
      nieve: [
        "Nieve",
        "Traslados a centros de ski y actividades de invierno, próximamente.",
      ],
      terrestre: ["Terrestres", "Salidas terrestres, próximamente."],
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
              Nuestras excursiones
            </h2>
            <p className="exc-lead">
              Elegí por tipo de aventura. Salidas con guías que nacieron y viven
              acá: montaña, lago y bosque, contados por dentro.
            </p>
            {anyOffer && (
              <span className="exc-launch-pill">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ width: 13, height: 13, color: "#3a2608" }}
                >
                  <path d="M12 2 15 9l7 .5-5.5 4.5L20 21l-8-4.5L4 21l1.5-7L0 9.5 7 9z" />
                </svg>
                Mes de lanzamiento
              </span>
            )}
            {hasCategories && <ExcFilterChips counts={counts} />}
          </header>

          {/* s48 F2b — grid 3-col estilo siturismo (mockup v13): título en el
              body, pills cat/dur/OFF sobre la foto, acciones Ver detalle +
              Reservar. data-cat la setea el island ExcFilterChips. */}
          <ul className="exc-grid" id="exc-grid" role="list" data-cat="todos">
            {items.map((s) => (
              <li key={s.key} data-category={s.category ?? "otros"}>
                <article
                  className="exc-card"
                  aria-labelledby={`servicio-${s.key}-title`}
                >
                  <div className="exc-photo">
                    {cover(s)}
                    {catPill(s)}
                    {offerBadge(s)}
                    {durPill(s)}
                    <span className="exc-scrim" aria-hidden="true" />
                    <div className="exc-ovl">
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
                    <h3
                      id={`servicio-${s.key}-title`}
                      className="exc-card-title"
                      style={{ fontFamily: heading }}
                    >
                      {s.title}
                    </h3>
                    {horario(s)}
                    <p className="exc-desc">{s.description}</p>
                    <div className="exc-foot">{priceBlock(s)}</div>
                    <div className="exc-actions">
                      {hasDetalle(s) && (
                        <ServicioDetalle
                          detalle={s.detalle!}
                          title={s.title}
                          cover={s.image_url ?? s.gallery?.[0]}
                          gallery={s.gallery}
                          design={design}
                        />
                      )}
                      {(() => {
                        // F2: si la excursión tiene disponibilidad fetcheada -> Reservar abre el
                        // modal (con la excursión fijada); si no -> el CTA WhatsApp de siempre.
                        const avail = s.excursion_id
                          ? availability?.[s.excursion_id]
                          : undefined;
                        if (avail === undefined) return ctaLink(s);
                        const waHref = waCta
                          ? `https://wa.me/${waCta}?text=${encodeURIComponent(
                              `Hola! Quiero reservar ${s.title}.`,
                            )}`
                          : null;
                        return (
                          <ReservaModal
                            excursion={{
                              title: s.title,
                              meta: s.detalle?.duracion,
                            }}
                            availability={avail}
                            waHref={waHref}
                            design={design}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </article>
              </li>
            ))}
            {hasCategories &&
              (Object.keys(EMPTIES) as Array<keyof typeof EMPTIES>)
                .filter((k) => counts[k] === 0)
                .map((k) => (
                  <li key={`empty-${k}`} className="exc-empty" data-empty={k}>
                    <b style={{ fontFamily: heading }}>{EMPTIES[k][0]}</b>
                    {EMPTIES[k][1]}
                    <span className="exc-empty-tag">
                      Categoría lista para cuando sumes salidas
                    </span>
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
