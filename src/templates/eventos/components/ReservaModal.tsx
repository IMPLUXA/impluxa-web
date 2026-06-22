"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  DOW,
  buildMonthCells,
  monthLabel,
  todayIso,
} from "@/lib/agency/calendar-dates";
import type { PublicDia, PublicCategoria } from "@/lib/public/availability";
import { submitReserva } from "@/lib/public/reserva-actions";
import type { ReservaResult } from "@/lib/public/reserva-schema";
import type { EventosDesign } from "../schema";

// F2+F3 — modal de reserva PUBLICA, per-excursion (overlay/turismo). Se abre desde "Reservar".
// La excursion viene FIJADA desde el clic (no hay selector). Flujo wizard:
//   1 Fecha (F2, calendario read-only) -> 2 Pasajeros (desglose + total EN VIVO) -> 3 Datos
//   (form + privacidad + Turnstile) -> [submit -> public_crear_reserva] -> exito (pre_reserva, hold 30min).
// Pago online = F4 (todavia no): el exito coordina por WhatsApp.
//
// SEGURIDAD: el total en vivo es solo DISPLAY (basePriceArs x factor de cada categoria); el precio real lo
// calcula el RPC server-side (el cliente nunca manda monto). El tenant lo deriva el RPC del excursion. El
// submit pasa por el server-action submitReserva (Turnstile + rate-limit + honeypot server-side). El
// turnstileSiteKey (publico) llega como prop leido server-side (el cliente no toca process.env).
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

const arsFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const SOFT_MAX_SEATS = 20; // tope blando del UI; el anti-oversell real lo aplica el RPC.

type Estado = PublicDia["estado"];

export function ReservaModal({
  excursion,
  excursionId,
  basePriceArs,
  categorias,
  availability,
  waHref,
  design,
  turnstileSiteKey,
}: {
  excursion: { title: string; meta?: string };
  excursionId: string;
  basePriceArs?: number;
  categorias: PublicCategoria[];
  availability: PublicDia[];
  waHref: string | null;
  design: EventosDesign;
  turnstileSiteKey: string;
}) {
  const pine = design.colors.primary;
  const copper = design.colors.accent;
  const heading = design.fonts.heading;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 Fecha · 2 Pasajeros · 3 Datos · 4 exito
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    whatsapp: "",
    email: "",
    alojamiento: "",
    empresa: "", // honeypot
  });
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReservaResult | null>(null);
  const idemRef = useRef<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const today = todayIso();

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
  // Cupo restante conocido SOLO en escasez (ultimos_lugares trae el numero). Con cupo amplio: null.
  const cupoRestante =
    selData?.estado === "ultimos_lugares" ? (selData.quedan ?? null) : null;

  const totalSeats = useMemo(
    () => Object.values(qty).reduce((a, b) => a + b, 0),
    [qty],
  );
  const seatCap = cupoRestante ?? SOFT_MAX_SEATS;
  const unitArs = (c: PublicCategoria): number | null =>
    basePriceArs == null ? null : Math.round(basePriceArs * c.factor);
  const totalArs = useMemo(() => {
    if (basePriceArs == null) return null;
    return categorias.reduce(
      (sum, c) =>
        sum + (qty[c.code] ?? 0) * Math.round(basePriceArs * c.factor),
      0,
    );
  }, [qty, categorias, basePriceArs]);

  function resetAll() {
    setStep(1);
    setSelected(null);
    setQty({});
    setForm({
      nombre: "",
      apellido: "",
      whatsapp: "",
      email: "",
      alojamiento: "",
      empresa: "",
    });
    setToken("");
    setResult(null);
    setSubmitting(false);
    idemRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      // Focus-trap: Tab/Shift-Tab queda atrapado dentro del modal (no se escapa al sitio detras).
      if (e.key !== "Tab") return;
      const root = modalRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco inicial dentro del modal (a11y).
    const t = window.setTimeout(() => {
      const root = modalRef.current;
      const firstEl = root?.querySelector<HTMLElement>(FOCUSABLE);
      firstEl?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      // Restaura el foco al boton que abrio el modal (a11y).
      triggerRef.current?.focus();
    };
  }, [open]);

  function stepMonth(delta: number) {
    const next = curIdx + delta;
    if (next < minIdx || next > maxIdx) return;
    setSelected(null);
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  }

  function setQtyFor(code: string, delta: number) {
    setQty((prev) => {
      const cur = prev[code] ?? 0;
      const nextVal = cur + delta;
      if (nextVal < 0) return prev;
      if (delta > 0 && totalSeats >= seatCap) return prev;
      return { ...prev, [code]: nextVal };
    });
  }

  const formValid =
    form.nombre.trim() !== "" &&
    form.apellido.trim() !== "" &&
    form.whatsapp.trim().length >= 5 &&
    /^\S+@\S+\.\S+$/.test(form.email.trim());

  async function handleSubmit() {
    if (submitting || !formValid || !token || totalSeats < 1 || !selected)
      return;
    setSubmitting(true);
    setResult(null);
    const pasajeros = categorias
      .filter((c) => (qty[c.code] ?? 0) > 0)
      .map((c) => ({ categoria: c.code, qty: qty[c.code] }));
    const res = await submitReserva({
      excursion_id: excursionId,
      departure_date: selected,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      alojamiento: form.alojamiento.trim(),
      pasajeros,
      idempotency_key: idemRef.current,
      turnstileToken: token,
      empresa: form.empresa,
    });
    setResult(res);
    if (res.ok) setStep(4);
    setSubmitting(false);
  }

  const STEPS = ["Fecha", "Pasajeros", "Datos", "Pago", "Voucher"];
  // Mapeo del paso interno (1-4, 4=exito tras Datos) al indice del stepper visual (Pago/Voucher = F4).
  const visualStep = step <= 3 ? step : 4;

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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #E6DCC4",
    borderRadius: 11,
    padding: "11px 13px",
    fontSize: 14,
    fontFamily: "inherit",
    background: "#fff",
    color: "#1E2B2C",
    marginTop: 5,
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: pine,
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="exc-cta"
        onClick={() => {
          resetAll();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Reservar ${excursion.title}`}
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

      {open &&
        createPortal(
          <div
            className="rm-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`Reservar ${excursion.title}`}
            onClick={close}
          >
            <div
              className="rm-modal"
              ref={modalRef}
              onClick={(e) => e.stopPropagation()}
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
                  {(selected || excursion.meta) && (
                    <div style={{ fontSize: 12.5, color: "#6b736f" }}>
                      {selected ? (
                        <span style={{ textTransform: "capitalize" }}>
                          {dayLabel(selected)}
                        </span>
                      ) : (
                        excursion.meta
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
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
                  const n = i + 1;
                  const active = n === visualStep;
                  const done = n < visualStep;
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
                            background: done || active ? pine : "#E6DCC4",
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
                            : done
                              ? `2px solid ${pine}`
                              : "2px solid #E6DCC4",
                          background: active ? copper : done ? pine : "#fff",
                          color: active || done ? "#fff" : "#B7B0A1",
                          boxShadow: active
                            ? "0 0 0 4px rgba(180,132,72,.18)"
                            : undefined,
                        }}
                      >
                        {done ? "✓" : n}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          marginTop: 6,
                          color: active || done ? pine : "#B7B0A1",
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

              {/* ===================== PASO 1: FECHA (F2) ===================== */}
              {step === 1 && (
                <>
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
                                    ? {
                                        background: "transparent",
                                        color: "#c9c1ad",
                                      }
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
                                {!c.past &&
                                  estado === "disponible" &&
                                  !isSel && (
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
                    {(
                      [
                        ["Con salidas", ESCASEZ_VERDE],
                        ["Seleccionado", copper],
                        ["Sin disponibilidad", "#B7B0A1"],
                      ] as const
                    ).map(([txt, col]) => (
                      <span
                        key={txt}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <i
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: "50%",
                            background: col,
                            display: "inline-block",
                          }}
                        />
                        {txt}
                      </span>
                    ))}
                  </div>

                  {/* cartel WhatsApp */}
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
                      style={{
                        width: 19,
                        height: 19,
                        flex: "none",
                        marginTop: 1,
                      }}
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

                  <div className="rm-foot">
                    <button
                      type="button"
                      className="rm-btn"
                      disabled={!selected}
                      onClick={() => selected && setStep(2)}
                      style={{
                        background: copper,
                        color: "#fff",
                        opacity: selected ? 1 : 0.5,
                        marginLeft: "auto",
                      }}
                    >
                      Continuar ›
                    </button>
                  </div>
                </>
              )}

              {/* ===================== PASO 2: PASAJEROS ===================== */}
              {step === 2 && (
                <>
                  <div style={{ padding: "8px 22px 4px" }}>
                    <div
                      style={{
                        fontFamily: heading,
                        color: pine,
                        fontSize: 17,
                        margin: "14px 0 4px",
                      }}
                    >
                      ¿Quiénes viajan?
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#6b736f",
                        marginBottom: 12,
                      }}
                    >
                      Elegí la cantidad por tipo de pasajero. El total se
                      actualiza al instante.
                    </div>

                    {categorias.length === 0 && (
                      <div style={{ fontSize: 13, color: "#6b736f" }}>
                        No pudimos cargar las categorías. Coordiná por WhatsApp.
                      </div>
                    )}

                    {categorias.map((c) => {
                      const u = unitArs(c);
                      const n = qty[c.code] ?? 0;
                      const free = c.factor === 0;
                      return (
                        <div
                          key={c.code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "13px 0",
                            borderBottom: "1px solid #E6DCC4",
                          }}
                        >
                          <div>
                            <b
                              style={{
                                fontWeight: 700,
                                color: pine,
                                fontSize: 14.5,
                                display: "block",
                              }}
                            >
                              {c.label}
                            </b>
                            <small style={{ fontSize: 12, color: "#6b736f" }}>
                              {free
                                ? "Gratis · ocupa lugar"
                                : u != null
                                  ? arsFmt.format(u)
                                  : "Precio en el sitio"}
                            </small>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <button
                              type="button"
                              aria-label={`Quitar ${c.label}`}
                              disabled={n <= 0}
                              onClick={() => setQtyFor(c.code, -1)}
                              className="rm-step"
                              style={{
                                borderColor: n <= 0 ? "#E6DCC4" : copper,
                                color: n <= 0 ? "#B7B0A1" : copper,
                              }}
                            >
                              −
                            </button>
                            <span
                              style={{
                                minWidth: 20,
                                textAlign: "center",
                                fontWeight: 700,
                                color: pine,
                                fontSize: 15,
                              }}
                            >
                              {n}
                            </span>
                            <button
                              type="button"
                              aria-label={`Agregar ${c.label}`}
                              disabled={totalSeats >= seatCap}
                              onClick={() => setQtyFor(c.code, 1)}
                              className="rm-step"
                              style={{
                                borderColor:
                                  totalSeats >= seatCap ? "#E6DCC4" : copper,
                                color:
                                  totalSeats >= seatCap ? "#B7B0A1" : copper,
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        margin: "14px 0 4px",
                        background: pine,
                        color: "#fff",
                        borderRadius: 14,
                        padding: "14px 18px",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#cfe0dd" }}>
                        {totalSeats}{" "}
                        {totalSeats === 1 ? "pasajero" : "pasajeros"}
                        {cupoRestante != null && (
                          <>
                            {" "}
                            · quedan <b>{cupoRestante}</b>
                          </>
                        )}
                      </span>
                      <span
                        style={{
                          fontFamily: heading,
                          fontSize: 22,
                          fontWeight: 700,
                        }}
                      >
                        {totalArs != null ? arsFmt.format(totalArs) : "—"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "#8a918c",
                        textAlign: "center",
                        padding: "2px 4px 6px",
                      }}
                    >
                      Total estimado. El precio se calcula en el servidor con la
                      tarifa vigente; el monto final se confirma al pagar.
                    </div>
                  </div>

                  <div className="rm-foot">
                    <button
                      type="button"
                      className="rm-btn ghost"
                      onClick={() => setStep(1)}
                    >
                      ‹ Volver
                    </button>
                    <button
                      type="button"
                      className="rm-btn"
                      disabled={totalSeats < 1}
                      onClick={() => totalSeats >= 1 && setStep(3)}
                      style={{
                        background: copper,
                        color: "#fff",
                        opacity: totalSeats < 1 ? 0.5 : 1,
                        marginLeft: "auto",
                      }}
                    >
                      Continuar ›
                    </button>
                  </div>
                </>
              )}

              {/* ===================== PASO 3: DATOS ===================== */}
              {step === 3 && (
                <>
                  <div style={{ padding: "8px 22px 4px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                        background: "#F1E7D2",
                        border: "1px solid #E6DCC4",
                        borderRadius: 12,
                        padding: "11px 14px",
                        margin: "12px 0 4px",
                        fontSize: 12.5,
                        color: pine,
                      }}
                    >
                      {selected && (
                        <b
                          style={{
                            fontFamily: heading,
                            textTransform: "capitalize",
                          }}
                        >
                          {dayLabel(selected)}
                        </b>
                      )}
                      <span>
                        · {totalSeats}{" "}
                        {totalSeats === 1 ? "pasajero" : "pasajeros"}
                      </span>
                      {totalArs != null && (
                        <b style={{ fontFamily: heading }}>
                          · {arsFmt.format(totalArs)}
                        </b>
                      )}
                    </div>

                    <div
                      style={{
                        fontFamily: heading,
                        color: pine,
                        fontSize: 17,
                        margin: "12px 0 4px",
                      }}
                    >
                      Tus datos
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#6b736f",
                        marginBottom: 8,
                      }}
                    >
                      Para gestionar la reserva y coordinar el encuentro por
                      WhatsApp.
                    </div>

                    {/* honeypot: oculto, fuera del tab-order */}
                    <input
                      type="text"
                      name="empresa"
                      autoComplete="off"
                      tabIndex={-1}
                      aria-hidden="true"
                      value={form.empresa}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, empresa: e.target.value }))
                      }
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        width: 1,
                        height: 1,
                      }}
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <label style={{ display: "block" }}>
                        <span style={labelStyle}>Nombre</span>
                        <input
                          style={inputStyle}
                          value={form.nombre}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, nombre: e.target.value }))
                          }
                          placeholder="Juan"
                          autoComplete="given-name"
                        />
                      </label>
                      <label style={{ display: "block" }}>
                        <span style={labelStyle}>Apellido</span>
                        <input
                          style={inputStyle}
                          value={form.apellido}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, apellido: e.target.value }))
                          }
                          placeholder="Pérez"
                          autoComplete="family-name"
                        />
                      </label>
                    </div>
                    <label style={{ display: "block", marginTop: 10 }}>
                      <span style={labelStyle}>WhatsApp</span>
                      <input
                        style={inputStyle}
                        value={form.whatsapp}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, whatsapp: e.target.value }))
                        }
                        placeholder="+54 9 294 ..."
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </label>
                    <label style={{ display: "block", marginTop: 10 }}>
                      <span style={labelStyle}>Email</span>
                      <input
                        style={inputStyle}
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="juan@email.com"
                        inputMode="email"
                        autoComplete="email"
                      />
                    </label>
                    <label style={{ display: "block", marginTop: 10 }}>
                      <span style={labelStyle}>
                        Alojamiento en Bariloche{" "}
                        <span style={{ fontWeight: 400, color: "#8a918c" }}>
                          (opcional)
                        </span>
                      </span>
                      <input
                        style={inputStyle}
                        value={form.alojamiento}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            alojamiento: e.target.value,
                          }))
                        }
                        placeholder="Hotel / hostel / dirección"
                      />
                    </label>

                    <div
                      style={{
                        display: "flex",
                        gap: 9,
                        alignItems: "flex-start",
                        margin: "14px 0 2px",
                        fontSize: 11.8,
                        color: "#5a635f",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3E7C95"
                        strokeWidth="2"
                        style={{
                          width: 16,
                          height: 16,
                          flex: "none",
                          marginTop: 1,
                        }}
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>
                        Usamos tus datos <b>solo</b> para gestionar tu reserva y
                        contactarte por WhatsApp. No los compartimos con
                        terceros.
                      </span>
                    </div>

                    <div style={{ margin: "12px 0 2px" }}>
                      <Turnstile
                        siteKey={turnstileSiteKey}
                        onSuccess={setToken}
                        onExpire={() => setToken("")}
                        onError={() => setToken("")}
                        options={{ theme: "light" }}
                      />
                    </div>

                    {result && !result.ok && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "#b3261e",
                          margin: "8px 0 0",
                        }}
                      >
                        {result.error}
                      </p>
                    )}
                  </div>

                  <div className="rm-foot">
                    <button
                      type="button"
                      className="rm-btn ghost"
                      onClick={() => setStep(2)}
                    >
                      ‹ Volver
                    </button>
                    <button
                      type="button"
                      className="rm-btn"
                      disabled={!formValid || !token || submitting}
                      onClick={handleSubmit}
                      style={{
                        background: copper,
                        color: "#fff",
                        opacity: !formValid || !token || submitting ? 0.5 : 1,
                        marginLeft: "auto",
                      }}
                    >
                      {submitting ? "Confirmando…" : "Confirmar reserva ›"}
                    </button>
                  </div>
                </>
              )}

              {/* ===================== ÉXITO (tras Datos; Pago = F4) ===================== */}
              {step === 4 && result?.ok && (
                <div style={{ padding: "10px 22px 22px" }}>
                  <div style={{ textAlign: "center", padding: "18px 0 6px" }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
                        background: ESCASEZ_VERDE,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        margin: "0 auto 12px",
                      }}
                    >
                      ✓
                    </div>
                    <div
                      style={{
                        fontFamily: heading,
                        color: pine,
                        fontSize: 21,
                        fontWeight: 600,
                      }}
                    >
                      ¡Tu lugar está reservado!
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#5a635f",
                        margin: "6px auto 0",
                        maxWidth: 360,
                      }}
                    >
                      Te guardamos el cupo por 30 minutos. Te escribimos por
                      WhatsApp para coordinar el encuentro y el pago.
                    </p>
                  </div>

                  <div
                    style={{
                      background: "#F1E7D2",
                      border: "1px solid #E6DCC4",
                      borderRadius: 14,
                      padding: "14px 16px",
                      textAlign: "center",
                      margin: "8px 0 4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: ".12em",
                        color: "#8a7b55",
                        fontWeight: 700,
                      }}
                    >
                      Código de reserva
                    </div>
                    <div
                      style={{
                        fontFamily: heading,
                        fontSize: 30,
                        fontWeight: 700,
                        color: pine,
                        letterSpacing: ".08em",
                        marginTop: 4,
                      }}
                    >
                      {result.reservation_code}
                    </div>
                  </div>

                  <div className="rm-foot" style={{ paddingBottom: 0 }}>
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rm-btn"
                        style={{
                          background: "#25D366",
                          color: "#fff",
                          textDecoration: "none",
                        }}
                      >
                        Coordinar por WhatsApp ›
                      </a>
                    )}
                    <button
                      type="button"
                      className="rm-btn ghost"
                      onClick={close}
                      style={{ marginLeft: "auto" }}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      <style>{`
        .exc-cta{cursor:pointer}
        .rm-overlay{position:fixed;inset:0;z-index:1000;background:rgba(20,48,56,.62);
          display:flex;align-items:flex-start;justify-content:center;padding:36px 20px;
          overflow-y:auto;overscroll-behavior:contain}
        .rm-modal{width:100%;max-width:640px;background:#FBF7EE;border:1px solid #E6DCC4;
          border-radius:22px;box-shadow:0 40px 90px -28px rgba(20,48,56,.72);
          overflow:hidden auto;max-height:calc(100dvh - 72px);
          font-family:var(--font-hanken,inherit);color:#1E2B2C}
        .rm-step{width:34px;height:34px;border-radius:50%;border:1.5px solid;background:#fff;
          font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .rm-step:disabled{cursor:default}
        .rm-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 22px 22px;margin-top:6px}
        .rm-btn{display:inline-flex;align-items:center;gap:8px;border:none;border-radius:999px;
          padding:12px 24px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit}
        .rm-btn:disabled{cursor:default}
        .rm-btn.ghost{background:#fff;border:1px solid #E6DCC4;color:#143038}
        @media (max-width:680px){
          .rm-overlay{padding:0;align-items:stretch}
          .rm-modal{max-width:none;max-height:none;min-height:100dvh;border-radius:0;border:none}
        }
      `}</style>
    </>
  );
}
