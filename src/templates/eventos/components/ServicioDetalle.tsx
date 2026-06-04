"use client";
import Image from "next/image";
import { useCallback, useId, useRef, useState } from "react";
import type { EventosContent, EventosDesign } from "../schema";

/**
 * s39 P1 — Detalle de excursión (modal sobre la card v3 "overlay").
 *
 * Renderiza el TRIGGER ("Ver detalle de la salida") + un <dialog> nativo
 * (Esc / backdrop / ✕ para cerrar; el dialog nativo aporta focus-trap y
 * restore-focus al trigger). Vanilla, sin librería de modal.
 *
 * LAZY + OVERLAY-ONLY: este componente se importa con dynamic() desde
 * Servicios.tsx y SOLO se monta dentro del branch overlay cuando el servicio
 * tiene `detalle` (content-gate). Hakuna / cualquier tenant en "stack" nunca lo
 * referencia -> el chunk JS no entra a su bundle -> byte-idéntico (espejo del
 * patrón de ServicioGallery).
 *
 * Paleta hardcodeada (Pine/Copper/Lake/Bone): misma convención que el bloque
 * .exc-* / .pv-hero-* (handoff turismo, "no schema home"). Solo la tipografía de
 * títulos usa design.fonts.heading (Cinzel en PV), igual que el branch overlay.
 *
 * Las listas itinerario/incluye/no_incluye renderizan SOLO si están pobladas
 * (length-guard). Ausentes -> no se renderiza nada (NO hay caja "próximamente").
 */

type Detalle = NonNullable<EventosContent["servicios"][number]["detalle"]>;

const C = {
  pine: "#143038",
  pineDeep: "#0E2329",
  panel: "#16363f",
  panel2: "#122d35",
  copper: "#B48448",
  lake: "#3E7C95",
  bone: "#F6F1E8",
  sand: "#F7F2E8",
};

// stroke icons (currentColor) — viewBox 0 0 24 24
const IconClock = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);
const IconSignal = <path d="M3 20h18M7 20V10M12 20V4M17 20v-7" />;
const IconCalendar = (
  <>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </>
);
const IconPin = (
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>
);

function Svg({
  children,
  size = 17,
  color = C.copper,
  width = 2,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  width?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: size, height: size, flex: "none" }}
    >
      {children}
    </svg>
  );
}

function Fact({
  icon,
  k,
  children,
}: {
  icon: React.ReactNode;
  k: string;
  children: React.ReactNode;
}) {
  return (
    <li style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span
        style={{
          flex: "none",
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(180,132,72,0.13)",
          border: "1px solid rgba(180,132,72,0.34)",
        }}
      >
        <Svg>{icon}</Svg>
      </span>
      <span>
        <span
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            color: "rgba(247,242,232,0.55)",
            marginBottom: 2,
          }}
        >
          {k}
        </span>
        <span style={{ fontSize: "0.95rem", fontWeight: 500, color: C.bone }}>
          {children}
        </span>
      </span>
    </li>
  );
}

function ListBlock({
  title,
  items,
  variant,
  heading,
}: {
  title: string;
  items: string[];
  variant: "check" | "cross" | "step";
  heading: string;
}) {
  const mark =
    variant === "check" ? (
      <Svg size={15} color="#7FB48A">
        <path d="M20 6 9 17l-5-5" />
      </Svg>
    ) : variant === "cross" ? (
      <Svg size={15} color="rgba(247,242,232,0.45)">
        <path d="M18 6 6 18M6 6l12 12" />
      </Svg>
    ) : null;
  return (
    <section style={{ marginBottom: 18 }}>
      <h4
        style={{
          fontFamily: heading,
          fontWeight: 600,
          fontSize: "1rem",
          color: C.bone,
          margin: "0 0 10px",
        }}
      >
        {title}
      </h4>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          counterReset: "dt-step",
        }}
      >
        {items.map((it, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              fontSize: "0.92rem",
              color: "rgba(247,242,232,0.85)",
            }}
          >
            {variant === "step" ? (
              <span
                aria-hidden="true"
                style={{
                  flex: "none",
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.pineDeep,
                  background: C.copper,
                }}
              >
                {i + 1}
              </span>
            ) : (
              <span style={{ marginTop: 2 }}>{mark}</span>
            )}
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// s39 P1 — Una FAQ (disclosure custom, espejo del patrón de Pautas.tsx). useId +
// aria-expanded/aria-controls + hidden; NO <details> nativo (evita el marker que
// necesitaría CSS global). Esc NO se captura aquí -> burbujea al <dialog> que
// cierra. La respuesta `a` se renderiza como TEXTO PLANO (React escapa), nunca
// dangerouslySetInnerHTML. Key por index en el caller (FAQs orden-fijo).
function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const btnId = `${baseId}-q`;
  const panelId = `${baseId}-a`;
  return (
    <div
      style={{
        border: "1px solid rgba(247,242,232,0.12)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 8,
        background: "rgba(20,48,56,0.32)",
      }}
    >
      <h5 style={{ margin: 0 }}>
        <button
          id={btnId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            minHeight: 44,
            padding: "13px 15px",
            fontFamily: "inherit",
            fontSize: "0.92rem",
            fontWeight: 600,
            color: C.bone,
            background: "none",
            border: 0,
            cursor: "pointer",
            textAlign: "left",
            outlineColor: C.copper,
          }}
        >
          <span>{q}</span>
          <span
            aria-hidden="true"
            style={{
              flex: "none",
              color: C.copper,
              fontSize: 18,
              lineHeight: 1,
              transform: open ? "rotate(45deg)" : "none",
              transition: "transform 0.25s ease",
            }}
          >
            +
          </span>
        </button>
      </h5>
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        hidden={!open}
        style={{
          padding: "0 15px 14px",
          fontSize: "0.9rem",
          color: "rgba(247,242,232,0.8)",
        }}
      >
        {a}
      </div>
    </div>
  );
}

export function ServicioDetalle({
  detalle,
  title,
  cover,
  design,
}: {
  detalle: Detalle;
  title: string;
  cover?: string;
  design: EventosDesign;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const labelId = useId();
  const heading = design.fonts.heading;

  const open = useCallback(() => dialogRef.current?.showModal(), []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  const d = detalle;
  const hasHorarios = !!d.horarios && d.horarios.length > 0;
  const hasItinerario = !!d.itinerario && d.itinerario.length > 0;
  const hasIncluye = !!d.incluye && d.incluye.length > 0;
  const hasNoIncluye = !!d.no_incluye && d.no_incluye.length > 0;
  const hasFaqs = !!d.faqs && d.faqs.length > 0;
  const hasFacts =
    !!d.duracion || !!d.dificultad || hasHorarios || !!d.punto_salida;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`Ver detalle de ${title}`}
        className="focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          marginTop: 2,
          padding: "9px 14px",
          fontWeight: 600,
          fontSize: "0.86rem",
          color: C.bone,
          cursor: "pointer",
          background: "rgba(20,48,56,0.45)",
          border: "1px solid rgba(247,242,232,0.18)",
          borderRadius: 11,
          outlineColor: C.copper,
        }}
      >
        <Svg size={15}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </Svg>
        Ver detalle de la salida
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={labelId}
        onClick={(e) => {
          // Backdrop-click-to-close: el hijo scroll es full-bleed (dialog padding 0),
          // así que `e.target === dialog` casi no dispara. Calculamos por el rect del
          // dialog: click fuera de la caja (en el ::backdrop) cierra. Esc/✕ cierran igual.
          const dlg = dialogRef.current;
          if (!dlg) return;
          const r = dlg.getBoundingClientRect();
          const inside =
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom;
          if (!inside) close();
        }}
        style={{
          width: "min(92vw, 600px)",
          maxHeight: "90vh",
          padding: 0,
          border: 0,
          borderRadius: 20,
          overflow: "hidden",
          color: C.sand,
          background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panel2} 100%)`,
        }}
      >
        <div style={{ maxHeight: "90vh", overflowY: "auto" }}>
          {cover && (
            <div
              style={{
                position: "relative",
                aspectRatio: "16 / 7",
                overflow: "hidden",
              }}
            >
              <Image
                src={cover}
                alt={title}
                fill
                className="object-cover"
                sizes="(min-width: 600px) 600px, 92vw"
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(180deg, rgba(14,35,41,0) 30%, rgba(14,35,41,0.55) 70%, ${C.panel2} 100%)`,
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={close}
            aria-label="Cerrar detalle"
            className="focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 3,
              width: 38,
              height: 38,
              border: "1px solid rgba(247,242,232,0.22)",
              borderRadius: 999,
              background: "rgba(14,35,41,0.6)",
              color: C.bone,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              outlineColor: C.copper,
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>

          <div style={{ padding: cover ? "20px 26px 28px" : "26px 26px 28px" }}>
            <span
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: C.copper,
                marginBottom: 6,
              }}
            >
              Detalle de la salida
            </span>
            <h3
              id={labelId}
              style={{
                fontFamily: heading,
                fontWeight: 700,
                fontSize: "1.7rem",
                lineHeight: 1.1,
                color: C.bone,
                margin: "0 0 20px",
              }}
            >
              {title}
            </h3>

            {hasFacts && (
              <ul
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px 18px",
                  listStyle: "none",
                  margin: "0 0 20px",
                  padding: 0,
                }}
              >
                {d.duracion && (
                  <Fact icon={IconClock} k="Duración">
                    {d.duracion}
                  </Fact>
                )}
                {d.dificultad && (
                  <Fact icon={IconSignal} k="Dificultad">
                    {d.dificultad}
                  </Fact>
                )}
                {hasHorarios && (
                  <Fact icon={IconCalendar} k="Horarios">
                    {d.horarios!.map((line, i) => (
                      <span key={i} style={{ display: "block" }}>
                        {line}
                      </span>
                    ))}
                  </Fact>
                )}
                {d.punto_salida && (
                  <Fact icon={IconPin} k="Punto de salida">
                    {d.punto_salida}
                  </Fact>
                )}
              </ul>
            )}

            {hasItinerario && (
              <ListBlock
                title="Itinerario"
                items={d.itinerario!}
                variant="step"
                heading={heading}
              />
            )}
            {hasIncluye && (
              <ListBlock
                title="Qué incluye"
                items={d.incluye!}
                variant="check"
                heading={heading}
              />
            )}
            {hasNoIncluye && (
              <ListBlock
                title="Qué no incluye"
                items={d.no_incluye!}
                variant="cross"
                heading={heading}
              />
            )}

            {d.cancelacion && (
              <div
                style={{
                  display: "flex",
                  gap: 11,
                  alignItems: "flex-start",
                  padding: "13px 15px",
                  borderRadius: 12,
                  background: "rgba(62,124,149,0.12)",
                  border: "1px solid rgba(62,124,149,0.32)",
                  marginBottom: 4,
                }}
              >
                <Svg size={18} color={C.lake}>
                  <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                  <path d="m9 12 2 2 4-4" />
                </Svg>
                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.13em",
                      textTransform: "uppercase",
                      color: "rgba(247,242,232,0.6)",
                      marginBottom: 2,
                    }}
                  >
                    Cancelación
                  </span>
                  <span style={{ fontSize: "0.92rem", color: C.bone }}>
                    {d.cancelacion}
                  </span>
                </span>
              </div>
            )}

            {hasFaqs && (
              <section style={{ marginTop: 4 }}>
                <h4
                  style={{
                    fontFamily: heading,
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: C.bone,
                    margin: "0 0 12px",
                  }}
                >
                  Preguntas frecuentes
                </h4>
                {d.faqs!.map((f, i) => (
                  <Faq key={i} q={f.q} a={f.a} />
                ))}
              </section>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
