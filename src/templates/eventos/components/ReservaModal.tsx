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
import { iniciarPagoPublico } from "@/lib/public/pago-actions";
import type { ReservaResult } from "@/lib/public/reserva-schema";
import type { EventosDesign } from "../schema";

// Isotipo OFICIAL de Mercado Pago (SimpleIcons) — el mismo del mockup v5 aprobado. Va en un badge
// blanco dentro del botón MP-azul para que el pago sea reconocible y confiable (pedido CEO).
const MP_ISOTYPE_PATH =
  "M11.115 16.479a.93.927 0 0 1-.939-.886c-.002-.042-.006-.155-.103-.155-.04 0-.074.023-.113.059-.112.103-.254.206-.46.206a.816.814 0 0 1-.305-.066c-.535-.214-.542-.578-.521-.725.006-.038.007-.08-.02-.11l-.032-.03h-.034c-.027 0-.055.012-.093.039a.788.786 0 0 1-.454.16.7.699 0 0 1-.253-.05c-.708-.27-.65-.928-.617-1.126.005-.041-.005-.072-.03-.092l-.05-.04-.047.043a.728.726 0 0 1-.505.203.73.728 0 0 1-.732-.725c0-.4.328-.722.732-.722.364 0 .675.27.721.63l.026.195.11-.165c.01-.018.307-.46.852-.46.102 0 .21.016.316.05.434.13.508.52.519.68.008.094.075.1.09.1.037 0 .064-.024.083-.045a.746.744 0 0 1 .54-.225c.128 0 .263.03.402.09.69.293.379 1.158.374 1.167-.058.144-.061.207-.005.244l.027.013h.02c.03 0 .07-.014.134-.035.093-.032.235-.08.367-.08a.944.942 0 0 1 .94.93.936.934 0 0 1-.94.928zm7.302-4.171c-1.138-.98-3.768-3.24-4.481-3.77-.406-.302-.685-.462-.928-.533a1.559 1.554 0 0 0-.456-.07c-.182 0-.376.032-.58.095-.46.145-.918.505-1.362.854l-.023.018c-.414.324-.84.66-1.164.73a1.986 1.98 0 0 1-.43.049c-.362 0-.687-.104-.81-.258-.02-.025-.007-.066.04-.125l.008-.008 1-1.067c.783-.774 1.525-1.506 3.23-1.545h.085c1.062 0 2.12.469 2.24.524a7.03 7.03 0 0 0 3.056.724c1.076 0 2.188-.263 3.354-.795a9.135 9.11 0 0 0-.405-.317c-1.025.44-2.003.66-2.946.66-.962 0-1.925-.229-2.858-.68-.05-.022-1.22-.567-2.44-.57-.032 0-.065 0-.096.002-1.434.033-2.24.536-2.782.976-.528.013-.982.138-1.388.25-.361.1-.673.186-.979.185-.125 0-.35-.01-.37-.012-.35-.01-2.115-.437-3.518-.962-.143.1-.28.203-.415.31 1.466.593 3.25 1.053 3.812 1.089.157.01.323.027.491.027.372 0 .744-.103 1.104-.203.213-.059.446-.123.692-.17l-.196.194-1.017 1.087c-.08.08-.254.294-.14.557a.705.703 0 0 0 .268.292c.243.162.677.27 1.08.271.152 0 .297-.015.43-.044.427-.095.874-.448 1.349-.82.377-.296.913-.672 1.323-.782a1.494 1.49 0 0 1 .37-.05.611.61 0 0 1 .095.005c.27.034.533.125 1.003.472.835.62 4.531 3.815 4.566 3.846.002.002.238.203.22.537-.007.186-.11.352-.294.466a.902.9 0 0 1-.484.15.804.802 0 0 1-.428-.124c-.014-.01-1.28-1.157-1.746-1.543-.074-.06-.146-.115-.22-.115a.122.122 0 0 0-.096.045c-.073.09.01.212.105.294l1.48 1.47c.002 0 .184.17.204.395.012.244-.106.447-.35.606a.957.955 0 0 1-.526.171.766.764 0 0 1-.42-.127l-.214-.206a21.035 20.978 0 0 0-1.08-1.009c-.072-.058-.148-.112-.221-.112a.127.127 0 0 0-.094.038c-.033.037-.056.103.028.212a.698.696 0 0 0 .075.083l1.078 1.198c.01.01.222.26.024.511l-.038.048a1.18 1.178 0 0 1-.1.096c-.184.15-.43.164-.527.164a.8.798 0 0 1-.147-.012c-.106-.018-.178-.048-.212-.089l-.013-.013c-.06-.06-.602-.609-1.054-.98-.059-.05-.133-.11-.21-.11a.128.128 0 0 0-.096.042c-.09.096.044.24.1.293l.92 1.003a.204.204 0 0 1-.033.062c-.033.044-.144.155-.479.196a.91.907 0 0 1-.122.007c-.345 0-.712-.164-.902-.264a1.343 1.34 0 0 0 .13-.576 1.368 1.365 0 0 0-1.42-1.357c.024-.342-.025-.99-.697-1.274a1.455 1.452 0 0 0-.575-.125c-.146 0-.287.025-.42.075a1.153 1.15 0 0 0-.671-.564 1.52 1.515 0 0 0-.494-.085c-.28 0-.537.08-.767.242a1.168 1.165 0 0 0-.903-.43 1.173 1.17 0 0 0-.82.335c-.287-.217-1.425-.93-4.467-1.613a17.39 17.344 0 0 1-.692-.189 4.822 4.82 0 0 0-.077.494l.67.157c3.108.682 4.136 1.391 4.309 1.525a1.145 1.142 0 0 0-.09.442 1.16 1.158 0 0 0 1.378 1.132c.096.467.406.821.879 1.003a1.165 1.162 0 0 0 .415.08c.09 0 .179-.012.266-.034.086.22.282.493.722.668a1.233 1.23 0 0 0 .457.094c.122 0 .241-.022.355-.063a1.373 1.37 0 0 0 1.269.841c.37.002.726-.147.985-.41.221.121.688.341 1.163.341.06 0 .118-.002.175-.01.47-.059.689-.24.789-.382a.571.57 0 0 0 .048-.078c.11.032.234.058.373.058.255 0 .501-.086.75-.265.244-.174.418-.424.444-.637v-.01c.083.017.167.026.251.026.265 0 .527-.082.773-.242.48-.31.562-.715.554-.98a1.28 1.279 0 0 0 .978-.194 1.04 1.04 0 0 0 .502-.808 1.088 1.085 0 0 0-.16-.653c.804-.342 2.636-1.003 4.795-1.483a4.734 4.721 0 0 0-.067-.492 27.742 27.667 0 0 0-5.049 1.62zm5.123-.763c0 4.027-5.166 7.293-11.537 7.293-6.372 0-11.538-3.266-11.538-7.293 0-4.028 5.165-7.293 11.539-7.293 6.371 0 11.537 3.265 11.537 7.293zm.46.004c0-4.272-5.374-7.755-12-7.755S.002 7.277.002 11.55L0 12.004c0 4.533 4.695 8.203 11.999 8.203 7.347 0 12-3.67 12-8.204z";

function MpIsotype() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        borderRadius: 7,
        width: 46,
        height: 32,
        flex: "none",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="#009EE3"
        style={{ width: 34, height: 32, display: "block" }}
      >
        <path d={MP_ISOTYPE_PATH} />
      </svg>
    </span>
  );
}

// F2+F3+F4 — modal de reserva PUBLICA, per-excursion (overlay/turismo). Se abre desde "Reservar".
// La excursion viene FIJADA desde el clic (no hay selector). Flujo wizard:
//   1 Fecha (F2, calendario read-only) -> 2 Pasajeros (desglose + total EN VIVO) -> 3 Datos
//   (form + privacidad + Turnstile) -> [submit -> public_crear_reserva, pre_reserva hold 45min] ->
//   4 Pago (F4: resumen + Pagar con Mercado Pago -> Checkout Pro) -> Voucher (5): el turista vuelve
//   de MP a la home con ?mp=return y ReservaReturn muestra el voucher on-site; el voucher REAL llega
//   por email (lo dispara el webhook al confirmar el pago).
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
  const [step, setStep] = useState(1); // 1 Fecha · 2 Pasajeros · 3 Datos · 4 Pago (F4)
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
  const [paying, setPaying] = useState(false); // F4: redirigiendo a MercadoPago
  const [payError, setPayError] = useState("");
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
    setPaying(false);
    setPayError("");
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
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restaura el foco al boton que abrio el modal (a11y).
      triggerRef.current?.focus();
    };
  }, [open]);

  // Foco inicial + reposicion al cambiar de paso (a11y: el foco no debe "morir" cuando se desmonta el
  // boton del paso anterior). setTimeout 0 espera el commit del DOM del nuevo paso.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, step]);

  // Cambiar de fecha re-arranca la seleccion de pasajeros (evita arrastrar un qty mayor al cupo de la
  // nueva fecha). El flujo normal es fecha->pasajeros, asi que solo afecta el ir-y-volver.
  useEffect(() => {
    setQty({});
  }, [selected]);

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
      // Total calculado DENTRO del updater (no del closure stale) -> el cap no se pasa por carrera.
      const draft = { ...prev, [code]: nextVal };
      const newTotal = Object.values(draft).reduce((a, b) => a + b, 0);
      if (delta > 0 && newTotal > seatCap) return prev;
      return draft;
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
    try {
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
    } catch {
      // Si la red corta, el boton no debe quedar colgado. La idempotency_key se reusa: un reintento
      // hace replay de la reserva ya creada si el server llego a crearla (no duplica).
      setResult({
        ok: false,
        error: "No pudimos conectar. Revisá tu conexión y probá de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // F4 — inicia el pago MP: server-action -> init_point -> redirect a Checkout Pro. El monto y el
  // tenant los pone el RPC del snapshot (el cliente nunca los manda). Guarda datos para el voucher
  // on-site del retorno; la fuente de verdad del voucher es el email (lo dispara el webhook).
  async function handlePagar() {
    if (!result?.ok || paying) return;
    setPaying(true);
    setPayError("");
    try {
      const r = await iniciarPagoPublico(result.reserva_id, excursion.title);
      if (r.ok) {
        try {
          sessionStorage.setItem(
            "pv_reserva_return",
            JSON.stringify({
              code: result.reservation_code,
              excursionTitle: excursion.title,
              dateLabel: selected ? dayLabel(selected) : "",
              pax: totalSeats,
              totalArs: result.gross_cents / 100,
            }),
          );
        } catch {
          /* sessionStorage no disponible: el voucher email es la fuente de verdad igual */
        }
        window.location.href = r.init_point; // redirect (no reseteamos paying)
      } else {
        setPayError(r.error);
        setPaying(false);
      }
    } catch {
      setPayError("No pudimos abrir el pago. Probá de nuevo.");
      setPaying(false);
    }
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

              {/* ===================== PASO 4: PAGO (F4) ===================== */}
              {step === 4 && result?.ok && (
                <div style={{ padding: "8px 22px 4px" }}>
                  <div
                    style={{
                      fontFamily: heading,
                      color: pine,
                      fontSize: 17,
                      margin: "12px 0 2px",
                    }}
                  >
                    Último paso: el pago
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "#6b736f",
                      marginBottom: 10,
                    }}
                  >
                    Tu reserva{" "}
                    <b style={{ color: pine }}>{result.reservation_code}</b>{" "}
                    está guardada. Completá el pago para confirmarla.
                  </div>

                  {/* resumen */}
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #E6DCC4",
                      borderRadius: 14,
                      padding: "14px 16px",
                      margin: "4px 0 12px",
                    }}
                  >
                    {(
                      [
                        ["Excursión", excursion.title],
                        [
                          "Fecha de salida",
                          selected ? dayLabel(selected) : "—",
                        ],
                        [
                          "Pasajeros",
                          categorias
                            .filter((c) => (qty[c.code] ?? 0) > 0)
                            .map((c) => `${qty[c.code]}× ${c.label}`)
                            .join(" · ") || `${totalSeats}`,
                        ],
                      ] as const
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "5px 0",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ color: "#6b736f" }}>{k}</span>
                        <span
                          style={{
                            color: pine,
                            fontWeight: 700,
                            textAlign: "right",
                            textTransform:
                              k === "Fecha de salida" ? "capitalize" : "none",
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 8,
                        paddingTop: 10,
                        borderTop: "1px solid #E6DCC4",
                      }}
                    >
                      <span style={{ color: pine, fontWeight: 700 }}>
                        Total a pagar
                      </span>
                      <span
                        style={{
                          fontFamily: heading,
                          fontSize: 22,
                          fontWeight: 700,
                          color: pine,
                        }}
                      >
                        {arsFmt.format(result.gross_cents / 100)}
                      </span>
                    </div>
                  </div>

                  {/* hold notice */}
                  <div
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "center",
                      background: "#F1E7D2",
                      border: "1px solid #E6DCC4",
                      borderRadius: 11,
                      padding: "10px 13px",
                      fontSize: 12.5,
                      color: "#7a6a45",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>⏳</span>
                    Te guardamos el lugar <b>45 minutos</b> para que completes
                    el pago.
                  </div>

                  {/* botón Mercado Pago oficial */}
                  <button
                    type="button"
                    onClick={handlePagar}
                    disabled={paying}
                    style={{
                      width: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      background: "#009EE3",
                      color: "#fff",
                      border: "none",
                      borderRadius: 14,
                      padding: "13px 18px",
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: paying ? "default" : "pointer",
                      opacity: paying ? 0.7 : 1,
                      marginTop: 12,
                    }}
                  >
                    <MpIsotype />
                    {paying ? "Abriendo el pago…" : "Pagar con Mercado Pago"}
                  </button>

                  {payError && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#b3261e",
                        margin: "10px 0 0",
                      }}
                    >
                      {payError}
                    </p>
                  )}

                  {/* nota de seguridad */}
                  <div
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                      margin: "14px 0 4px",
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
                      Pago seguro vía Mercado Pago. El monto lo calcula el
                      servidor — <b>no se puede modificar</b>. El cobro va
                      directo a la agencia, sin intermediarios.
                    </span>
                  </div>

                  {/* fallback WhatsApp */}
                  <div className="rm-foot" style={{ paddingTop: 6 }}>
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12.5,
                          color: "#5a635f",
                          textDecoration: "underline",
                        }}
                      >
                        ¿Preferís coordinar el pago por WhatsApp?
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
