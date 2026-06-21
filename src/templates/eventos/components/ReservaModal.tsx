"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DOW,
  buildMonthCells,
  monthLabel,
  todayIso,
} from "@/lib/agency/calendar-dates";
import type { PublicDia } from "@/lib/public/availability";
import type { EventosDesign } from "../schema";

// F2 — modal de disponibilidad PUBLICA, per-excursion. Se abre desde el boton "Reservar" de cada
// card de Servicios (overlay/turismo). La excursion viene FIJADA desde el clic (no hay selector).
// READ-ONLY: muestra el calendario de disponibilidad (paso 1 del flujo de reserva); reservar online
// es F3 (el CTA del modal sigue siendo WhatsApp). La disponibilidad se renderiza SERVER-SIDE en el ISR
// y llega como prop `availability` (sparse: solo dias no-default; el resto se pinta "disponible").
//
// Dynamic-import en Servicios (overlay-only): el branch stack (Hakuna) nunca importa este chunk ->
// byte-identidad por construccion.

const ESCASEZ_VERDE = "#3F7D5A";

const dayFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
});
function dayLabel(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}

type Estado = PublicDia["estado"];

export function ReservaModal({
  excursion,
  availability,
  waHref,
  design,
}: {
  excursion: { title: string; meta?: string };
  availability: PublicDia[];
  waHref: string | null;
  design: EventosDesign;
}) {
  const pine = design.colors.primary;
  const copper = design.colors.accent;
  const heading = design.fonts.heading;

  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayIso();

  // Ventana navegable: mes actual .. +2 (cubre los ~62 dias que trae el server). Mas alla, no hay data.
  const minIdx = now.getFullYear() * 12 + now.getMonth();
  const curIdx = year * 12 + month0;
  const maxIdx = minIdx + 2;

  const availMap = useMemo(
    () => new Map(availability.map((d) => [d.fecha, d])),
    [availability],
  );
  const cells = useMemo(
    () => buildMonthCells(year, month0, today),
    [year, month0, today],
  );
  const selData = selected ? availMap.get(selected) : undefined;
  const selEstado: Estado = selData?.estado ?? "disponible";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function stepMonth(delta: number) {
    const next = curIdx + delta;
    if (next < minIdx || next > maxIdx) return;
    setSelected(null);
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  }

  const STEPS = ["Fecha", "Pasajeros", "Datos", "Pago", "Voucher"];

  function dayStyle(estado: Estado, isSel: boolean): React.CSSProperties {
    if (isSel)
      return {
        background: copper,
        borderColor: copper,
        color: "#fff",
        boxShadow: "0 0 0 3px rgba(180,132,72,.22)",
      };
    if (estado === "sin_disponibilidad")
      return {
        background: "#ECE8E0",
        color: "#A8A192",
        borderColor: "transparent",
      };
    if (estado === "ultimos_lugares")
      return { background: "#fff", borderColor: "#D9A24A", color: pine };
    return { background: "#fff", borderColor: "#E6DCC4", color: pine };
  }

  return (
    <>
      <button
        type="button"
        className="exc-cta"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Reservar ${excursion.title} — ver disponibilidad`}
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
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Reservar ${excursion.title}`}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(20,48,56,.55)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#FBF7EE",
              border: "1px solid #E6DCC4",
              borderRadius: 22,
              boxShadow: "0 34px 80px -36px rgba(20,48,56,.65)",
              overflow: "hidden",
              fontFamily: "var(--font-hanken, inherit)",
              color: "#1E2B2C",
            }}
          >
            {/* header: excursion fijada */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "18px 20px 4px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: ".14em",
                    color: copper,
                    fontWeight: 700,
                  }}
                >
                  Reservá tu salida
                </div>
                <h2
                  style={{
                    fontFamily: heading,
                    color: pine,
                    fontWeight: 600,
                    fontSize: 21,
                    margin: "5px 0 3px",
                  }}
                >
                  {excursion.title}
                </h2>
                {excursion.meta && (
                  <div style={{ fontSize: 12.5, color: "#6b736f" }}>
                    {excursion.meta}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "1px solid #E6DCC4",
                  background: "#fff",
                  color: "#7b837f",
                  fontSize: 16,
                  cursor: "pointer",
                  flex: "none",
                }}
              >
                ×
              </button>
            </div>

            {/* stepper */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                padding: "14px 16px 4px",
              }}
            >
              {STEPS.map((label, i) => {
                const active = i === 0;
                return (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      position: "relative",
                      minWidth: 0,
                    }}
                  >
                    {i > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 14,
                          left: "-50%",
                          width: "100%",
                          height: 2,
                          background: "#E6DCC4",
                          zIndex: 0,
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12.5,
                        zIndex: 1,
                        border: active
                          ? `2px solid ${copper}`
                          : "2px solid #E6DCC4",
                        background: active ? copper : "#fff",
                        color: active ? "#fff" : "#B7B0A1",
                        boxShadow: active
                          ? "0 0 0 4px rgba(180,132,72,.18)"
                          : undefined,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        marginTop: 6,
                        color: active ? pine : "#B7B0A1",
                        fontWeight: active ? 700 : 600,
                        textAlign: "center",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "#8a918c",
                padding: "2px 16px 4px",
              }}
            >
              Reservá en 5 pasos. En esta etapa elegís la fecha; el resto del
              flujo llega muy pronto.
            </div>

            {/* calendario */}
            <div style={{ padding: "6px 20px 4px" }}>
              <div
                style={{
                  fontFamily: heading,
                  color: pine,
                  fontSize: 16,
                  margin: "12px 0 10px",
                  textAlign: "center",
                }}
              >
                Elegí la fecha de tu salida
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  disabled={curIdx <= minIdx}
                  aria-label="Mes anterior"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid #E6DCC4",
                    background: "#fff",
                    color: pine,
                    fontSize: 15,
                    cursor: curIdx <= minIdx ? "default" : "pointer",
                    opacity: curIdx <= minIdx ? 0.4 : 1,
                  }}
                >
                  ‹
                </button>
                <div
                  style={{
                    fontFamily: heading,
                    color: pine,
                    fontWeight: 600,
                    fontSize: 14.5,
                    textTransform: "capitalize",
                  }}
                >
                  {monthLabel(year, month0)}
                </div>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  disabled={curIdx >= maxIdx}
                  aria-label="Mes siguiente"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid #E6DCC4",
                    background: "#fff",
                    color: pine,
                    fontSize: 15,
                    cursor: curIdx >= maxIdx ? "default" : "pointer",
                    opacity: curIdx >= maxIdx ? 0.4 : 1,
                  }}
                >
                  ›
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  gap: 5,
                  marginBottom: 5,
                }}
              >
                {DOW.map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".05em",
                      color: "#9aa09c",
                      textTransform: "uppercase",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  gap: 5,
                }}
              >
                {cells.map((c, i) =>
                  c === null ? (
                    <div key={`b${i}`} />
                  ) : (
                    (() => {
                      const a = availMap.get(c.iso);
                      const estado: Estado = a?.estado ?? "disponible";
                      const isSel = selected === c.iso;
                      const bookable =
                        !c.past && estado !== "sin_disponibilidad";
                      return (
                        <button
                          key={c.iso}
                          type="button"
                          disabled={c.past || !bookable}
                          onClick={() => bookable && setSelected(c.iso)}
                          style={{
                            aspectRatio: "1/1",
                            borderRadius: 10,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13.5,
                            fontWeight: 600,
                            position: "relative",
                            border: "1px solid transparent",
                            cursor: bookable ? "pointer" : "default",
                            opacity: c.past ? 0.35 : 1,
                            ...(c.past
                              ? { background: "transparent", color: "#c9c1ad" }
                              : dayStyle(estado, isSel)),
                          }}
                        >
                          <span>{c.day}</span>
                          {!c.past &&
                            estado === "ultimos_lugares" &&
                            a?.quedan != null && (
                              <small
                                style={{
                                  fontSize: 8.5,
                                  fontWeight: 700,
                                  marginTop: 1,
                                  color: isSel ? "#fff8ee" : "#9A5B12",
                                }}
                              >
                                {a.quedan === 1
                                  ? "queda 1"
                                  : `quedan ${a.quedan}`}
                              </small>
                            )}
                          {!c.past && estado === "disponible" && !isSel && (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: ESCASEZ_VERDE,
                                position: "absolute",
                                bottom: 6,
                              }}
                            />
                          )}
                        </button>
                      );
                    })()
                  ),
                )}
              </div>
            </div>

            {/* leyenda */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "13px 18px",
                justifyContent: "center",
                padding: "14px 16px 2px",
                fontSize: 12,
                color: "#5a635f",
              }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <i
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: ESCASEZ_VERDE,
                    display: "inline-block",
                  }}
                />
                Con salidas
              </span>
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <i
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: copper,
                    display: "inline-block",
                  }}
                />
                Seleccionado
              </span>
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <i
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: "#B7B0A1",
                    display: "inline-block",
                  }}
                />
                Sin disponibilidad
              </span>
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 11.5,
                color: "#8a918c",
                padding: "2px 16px 6px",
              }}
            >
              Cuando quedan pocos lugares te mostramos cuántos. Con cupo amplio,
              solo “Con salidas”.
            </div>

            {/* detalle del dia elegido */}
            {selected && (
              <div
                style={{
                  margin: "10px 20px 0",
                  background: pine,
                  color: "#EDE4D0",
                  borderRadius: 14,
                  padding: "13px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontFamily: heading,
                    fontSize: 15,
                    color: "#fff",
                    textTransform: "capitalize",
                  }}
                >
                  {dayLabel(selected)}
                </div>
                {selEstado === "ultimos_lugares" && selData?.quedan != null ? (
                  <span
                    style={{
                      background: "#D9A24A",
                      color: "#3a230a",
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "4px 11px",
                      fontSize: 12,
                    }}
                  >
                    {selData.quedan === 1
                      ? "¡Último lugar!"
                      : `¡Quedan ${selData.quedan} lugares!`}
                  </span>
                ) : (
                  <span
                    style={{
                      background: "rgba(255,255,255,.12)",
                      borderRadius: 999,
                      padding: "4px 11px",
                      fontSize: 12,
                    }}
                  >
                    Con salidas
                  </span>
                )}
              </div>
            )}

            {/* cartel WhatsApp (horario/punto de partida) */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                margin: "13px 20px 2px",
                background: "#fff",
                border: "1px solid #E6DCC4",
                borderLeft: "3px solid #25D366",
                borderRadius: 11,
                padding: "11px 13px",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="#25D366"
                style={{ width: 19, height: 19, flex: "none", marginTop: 1 }}
              >
                <path d="M.06 24l1.68-6.13A11.86 11.86 0 010 12 12 12 0 1112 24a11.9 11.9 0 01-5.74-1.46zM6.6 20.13l.36.21A9.9 9.9 0 1012 21.92 9.93 9.93 0 002.08 12a9.83 9.83 0 001.52 5.26l.23.37-1 3.63z" />
              </svg>
              <p style={{ margin: 0, fontSize: 12.5, color: "#4b544f" }}>
                <b style={{ color: pine }}>
                  El punto de partida y el horario exacto se confirman por
                  WhatsApp al reservar.
                </b>{" "}
                Coordinamos con vos el encuentro según tu alojamiento.
              </p>
            </div>

            {/* footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "15px 20px 20px",
                marginTop: 4,
              }}
            >
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 999,
                    padding: "11px 22px",
                    fontSize: 14,
                    fontWeight: 700,
                    background: copper,
                    color: "#fff",
                    textDecoration: "none",
                  }}
                >
                  Coordinar por WhatsApp ›
                </a>
              ) : (
                <span
                  style={{
                    borderRadius: 999,
                    padding: "11px 22px",
                    fontSize: 14,
                    fontWeight: 700,
                    background: copper,
                    color: "#fff",
                    opacity: 0.6,
                  }}
                >
                  Continuar ›
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: "#8a918c",
                  flex: 1,
                  minWidth: 170,
                }}
              >
                Pasajeros · Datos · Pago online — próximamente. Por ahora
                coordinás por WhatsApp.
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`.exc-cta{cursor:pointer}`}</style>
    </>
  );
}
