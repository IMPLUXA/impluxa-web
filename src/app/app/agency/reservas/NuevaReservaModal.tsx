"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  DOW,
  buildMonthCells,
  monthLabel,
  monthRange,
  todayIso,
} from "@/lib/agency/calendar-dates";
import { availFromResponse } from "@/lib/agency/alta-availability";
import { grossCents, unitCents, centsToArs } from "@/lib/agency/pricing";
import type { ExcursionRow, PassengerCategoryRow } from "@/lib/agency/schemas";
import styles from "./NuevaReservaModal.module.css";

// Alta presencial branded (paridad con el wizard publico) — CORTE B: P1 Fecha /
// P2 Pasajeros (con total vivo) / P3 Datos / P4 Pago (4 casos) / P5 Voucher.
//
// Aislado: componente agency, llama SOLO los routes existentes (autoridad del
// cupo, del snapshot y de la plata). NO toca templates/eventos ni lib/public.
// NO hay logica de plata nueva: re-viste agency_crear_reserva + agency_confirmar_reserva
// + ruta pago-mp. El voucher lo dispara la ruta (gate confirmada===true), no este
// componente. El total mostrado replica EXACTO el del server (lib/agency/pricing).

const LAST_SPOTS = 5; // ponytail: umbral "ultimos lugares" (amber). El motor #24 es la autoridad real.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

const factorOf = (c: PassengerCategoryRow) => Number(String(c.price_factor));

type DayState = "available" | "last" | "soldout" | "past";
type Method = "efectivo" | "transferencia" | "mercadopago" | "sinpago";

type CalState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "cap_null" }
  | {
      kind: "ready";
      capacityDefault: number;
      dias: {
        fecha: string;
        estado: "open" | "limited" | "closed";
        eff_cap: number;
        restante: number;
      }[];
    };

type Done =
  | {
      kind: "voucher";
      code: string;
      methodLabel: string;
      total: number;
      paid: number;
      saldo: number;
    }
  | { kind: "mp_pending"; code: string; total: number; initPoint: string }
  | { kind: "mp_preview"; code: string; total: number }
  | { kind: "prereserva"; code: string; total: number; warn?: string };

const ars = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

export function NuevaReservaModal({
  excursions,
  categories,
  excursionRates,
  onClose,
  onCreated,
}: {
  excursions: ExcursionRow[];
  categories: PassengerCategoryRow[];
  excursionRates: Record<string, number>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = todayIso();
  const [excursionId, setExcursionId] = useState("");
  const [step, setStep] = useState(1); // 1 Fecha · 2 Pasajeros · 3 Datos · 4 Pago
  const [done, setDone] = useState<Done | null>(null);

  // calendario
  const now = new Date(`${today}T00:00:00Z`);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month0, setMonth0] = useState(now.getUTCMonth());
  const [cal, setCal] = useState<CalState>({ kind: "idle" });
  const [fecha, setFecha] = useState("");

  // pasajeros + titular
  const [pax, setPax] = useState<Record<string, number>>({});
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [holderPhone, setHolderPhone] = useState("");
  const [holderLodging, setHolderLodging] = useState("");

  // pago (P4)
  const [method, setMethod] = useState<Method | null>(null);
  const [sena, setSena] = useState(false);
  const [senaAmount, setSenaAmount] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ventana de navegacion: mes actual .. +12 meses (alineado al max +365d del alta).
  const minIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const curIdx = year * 12 + month0;
  const atMin = curIdx <= minIdx;
  const atMax = curIdx >= minIdx + 12;

  function shiftMonth(delta: number) {
    const idx = curIdx + delta;
    if (idx < minIdx || idx > minIdx + 12) return;
    setYear(Math.floor(idx / 12));
    setMonth0(idx % 12);
  }

  // fetch del mes (read-model agency compartido). Re-fetch al cambiar excursion o mes.
  useEffect(() => {
    if (!excursionId) {
      setCal({ kind: "idle" });
      return;
    }
    let alive = true;
    setCal({ kind: "loading" });
    const { from, to } = monthRange(year, month0);
    fetch(
      `/api/agency/departures/calendario?excursion_id=${excursionId}&from=${from}&to=${to}`,
    )
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok || !body.ok) return setCal({ kind: "error" });
        if (body.capacity_default == null) return setCal({ kind: "cap_null" });
        setCal({
          kind: "ready",
          capacityDefault: body.capacity_default,
          dias: body.dias ?? [],
        });
      })
      .catch(() => {
        if (alive) setCal({ kind: "error" });
      });
    return () => {
      alive = false;
    };
  }, [excursionId, year, month0]);

  function dayState(iso: string): DayState {
    if (iso < today) return "past";
    if (cal.kind !== "ready") return "available";
    const a = availFromResponse(
      { ok: true, capacity_default: cal.capacityDefault, dias: cal.dias },
      iso,
      true,
    );
    if (a.state === "closed") return "soldout";
    if (a.state === "open" || a.state === "limited") {
      if (a.restante <= 0) return "soldout";
      if (a.restante <= LAST_SPOTS) return "last";
      return "available";
    }
    return "soldout";
  }

  const cells = useMemo(
    () => buildMonthCells(year, month0, today),
    [year, month0, today],
  );

  const totalPax = Object.values(pax).reduce((a, b) => a + b, 0);

  function setQty(code: string, delta: number) {
    setPax((p) => {
      const next = Math.max(0, (p[code] ?? 0) + delta);
      return { ...p, [code]: next };
    });
  }

  // ---- total (replica EXACTA del server: lib/agency/pricing) ----
  const basePrice = excursionId ? excursionRates[excursionId] : undefined;
  const totalArs = useMemo(() => {
    if (basePrice == null) return null;
    const lines = categories.map((c) => ({
      factor: factorOf(c),
      qty: pax[c.code] ?? 0,
    }));
    return centsToArs(grossCents(basePrice, lines));
  }, [basePrice, categories, pax]);
  const unitArs = (c: PassengerCategoryRow) =>
    basePrice == null ? null : centsToArs(unitCents(basePrice, factorOf(c)));

  const dataComplete =
    !!excursionId &&
    !!fecha &&
    totalPax >= 1 &&
    holderName.trim() !== "" &&
    EMAIL_RE.test(holderEmail.trim());

  const senaNum = Number(senaAmount);
  const senaValid =
    !sena ||
    (Number.isFinite(senaNum) &&
      senaNum > 0 &&
      (totalArs == null || senaNum <= totalArs));
  const saldoArs =
    totalArs != null && sena ? Math.max(0, totalArs - senaNum) : 0;

  const canFinalize =
    !!method &&
    (method !== "efectivo" && method !== "transferencia" ? true : senaValid);

  function createErrorMessage(
    body: { error_code?: string; message?: string },
    httpStatus: number,
  ): string {
    switch (body.error_code) {
      case "CUPO_INSUFICIENTE":
        return "Cupo insuficiente para esa fecha";
      case "SALIDA_NO_DISPONIBLE":
        return "Ese día no admite reservas (cerrado o sin cupo)";
      case "SALIDA_INEXISTENTE":
        return "La excursión no está disponible";
      case "TARIFA_NO_VIGENTE":
        return "La excursión no tiene tarifa vigente";
      case "CATEGORIA_INVALIDA":
        return "Categoría de pasajero inválida";
    }
    if (httpStatus === 403) return "Sin permiso para esta acción";
    return body.message ?? "Error al crear la reserva";
  }

  function chargeErrorMessage(
    body: { error_code?: string; message?: string },
    httpStatus: number,
  ): string {
    switch (body.error_code) {
      case "MONTO_EXCEDE_SALDO":
        return "El monto excede el saldo";
      case "HOLD_VENCIDO":
        return "El hold de la reserva venció";
      case "METODO_PAGO_INVALIDO":
        return "Método de pago inválido";
      case "MP_NO_CONECTADO":
        return "El tenant no tiene MercadoPago conectado";
      case "MP_PREFERENCE_FAILED":
        return "No se pudo generar el link de MercadoPago";
    }
    if (httpStatus === 403) return "Sin permiso para cobrar";
    return body.message ?? "No se pudo registrar el cobro";
  }

  // Crear (agency_crear_reserva) -> cobrar/confirmar sobre ese reserva_id.
  // Cualquier create-OK avanza a P5; la variante refleja que paso con el cobro
  // (voucher / mp pendiente / pre-reserva). Un cobro fallido NO pierde la reserva
  // (queda pre_reserva, cobrable desde la lista): se reporta, no se esconde.
  async function finalize() {
    if (!method) return;
    setBusy(true);
    setError(null);

    const pasajeros = categories
      .map((c) => ({ categoria: c.code, qty: pax[c.code] ?? 0 }))
      .filter((p) => p.qty > 0);
    const createRes = await fetch("/api/agency/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        excursion_id: excursionId,
        departure_date: fecha,
        holder_name: holderName.trim(),
        holder_email: holderEmail.trim(),
        holder_phone: holderPhone.trim() || undefined,
        holder_lodging: holderLodging.trim() || undefined,
        pasajeros,
      }),
    });
    const cb = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !cb.reservation_code || !cb.reserva_id) {
      setBusy(false);
      setError(
        !createRes.ok
          ? createErrorMessage(cb, createRes.status)
          : "La reserva se creó pero el envelope llegó incompleto. Buscala en la lista.",
      );
      return;
    }
    const reservaId = cb.reserva_id as string;
    const code = cb.reservation_code as string;
    // gross_cents (centavos, autoritativo del server) -> ARS. Fallback al client.
    const grossSrv =
      cb.gross_cents != null ? Number(String(cb.gross_cents)) : NaN;
    const total = Number.isFinite(grossSrv)
      ? centsToArs(grossSrv)
      : (totalArs ?? 0);

    // cobrar-despues: crear sin pago.
    if (method === "sinpago") {
      setBusy(false);
      setDone({ kind: "prereserva", code, total });
      return;
    }

    // MercadoPago: link total-only (la ruta ignora el amount, usa snapshot).
    if (method === "mercadopago") {
      const mpRes = await fetch(`/api/agency/reservas/${reservaId}/pago-mp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: total }),
      });
      const mb = await mpRes.json().catch(() => ({}));
      setBusy(false);
      if (mpRes.status === 403 && mb.code === "E_NON_PROD") {
        setDone({ kind: "mp_preview", code, total });
        return;
      }
      if (!mpRes.ok || !mb.init_point) {
        setDone({
          kind: "prereserva",
          code,
          total,
          warn: `El link MP no se generó: ${chargeErrorMessage(mb, mpRes.status)}. Generalo desde la lista.`,
        });
        return;
      }
      setDone({ kind: "mp_pending", code, total, initPoint: mb.init_point });
      return;
    }

    // efectivo / transferencia: total o seña -> confirmar (gate del voucher en la ruta).
    // La seña va en pesos enteros (sin fracciones de centavo al RPC); el total full
    // se manda EXACTO (== snapshot_gross) para no pasarse del saldo.
    const amount = sena ? Math.round(senaNum) : total;
    const payRes = await fetch(`/api/agency/reservas/${reservaId}/pago`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method_code: method,
        amount,
        idempotency_key: crypto.randomUUID(),
        confirm: true,
      }),
    });
    const pb = await payRes.json().catch(() => ({}));
    setBusy(false);
    if (!payRes.ok) {
      setDone({
        kind: "prereserva",
        code,
        total,
        warn: `El cobro no se aplicó: ${chargeErrorMessage(pb, payRes.status)}. Cobrala desde la lista.`,
      });
      return;
    }
    const saldo = Math.max(0, total - amount);
    setDone({
      kind: "voucher",
      code,
      methodLabel: METHOD_LABEL[method] ?? method,
      total,
      paid: amount,
      saldo,
    });
  }

  const excursionName = useMemo(() => {
    const m = new Map(excursions.map((e) => [e.id, e.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [excursions]);

  // ---- P5 confirmacion ----
  if (done) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true">
        <div className={styles.modal}>
          <div className={styles.pane}>
            <div className={styles.vletter}>
              {done.kind === "voucher" ? <Check /> : <Clock />}
              <h2>
                {done.kind === "voucher"
                  ? "¡Reserva confirmada!"
                  : done.kind === "mp_pending"
                    ? "Link de pago generado"
                    : "Pre-reserva creada"}
              </h2>
              <p>
                {done.kind === "voucher"
                  ? "Le enviamos el voucher al email del pasajero."
                  : done.kind === "mp_pending"
                    ? "El cliente paga desde su teléfono. El voucher sale cuando MercadoPago confirma."
                    : done.kind === "mp_preview"
                      ? "En preview el link MP no se genera (solo en producción). La reserva quedó en hold."
                      : "Queda en hold. Cobrá desde la lista cuando recibas el pago."}
              </p>
            </div>

            <div className={styles.vrow}>
              <span className={styles.k}>Excursión</span>
              <span className={styles.v}>{excursionName(excursionId)}</span>
            </div>
            <div className={styles.vrow}>
              <span className={styles.k}>Fecha</span>
              <span className={styles.v}>{fecha}</span>
            </div>
            <div className={styles.vrow}>
              <span className={styles.k}>Pasajeros</span>
              <span className={styles.v}>{totalPax}</span>
            </div>

            {done.kind === "voucher" && done.saldo > 0 ? (
              <>
                <div className={styles.vrow}>
                  <span className={styles.k}>Seña ({done.methodLabel})</span>
                  <span className={styles.v}>{ars(done.paid)} · Pagado</span>
                </div>
                <div className={styles.vrow}>
                  <span className={styles.saldoK}>Saldo pendiente</span>
                  <span className={styles.saldoV}>{ars(done.saldo)}</span>
                </div>
              </>
            ) : done.kind === "voucher" ? (
              <>
                <div className={styles.vrow}>
                  <span className={styles.k}>Total</span>
                  <span className={styles.v}>{ars(done.total)} · Pagado</span>
                </div>
                <div className={styles.vrow}>
                  <span className={styles.k}>Método</span>
                  <span className={styles.v}>{done.methodLabel}</span>
                </div>
              </>
            ) : (
              <div className={styles.vrow}>
                <span className={styles.k}>Total</span>
                <span className={styles.v}>{ars(done.total)}</span>
              </div>
            )}

            {done.kind === "prereserva" && done.warn && (
              <div className={styles.err}>{done.warn}</div>
            )}

            {done.kind === "mp_pending" && (
              <div className={styles.mpBox}>
                <div className={styles.note}>
                  Link de pago de MercadoPago (cobra el total):
                </div>
                <a
                  className={styles.mpLink}
                  href={done.initPoint}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {done.initPoint}
                </a>
                <button
                  className={styles.copyBtn}
                  onClick={() => navigator.clipboard?.writeText(done.initPoint)}
                >
                  Copiar link
                </button>
                <div className={styles.noteMuted}>
                  Mandáselo al cliente (WhatsApp/email). El voucher sale solo
                  cuando MercadoPago confirma.
                </div>
              </div>
            )}

            <div className={styles.vcode}>
              <div className={styles.l}>Código de reserva</div>
              <div className={styles.c}>{done.code}</div>
            </div>
          </div>
          <div className={styles.foot}>
            <span />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onCreated}
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const STEPS = ["Fecha", "Pasajeros", "Datos", "Pago"];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.head}>
          <div className={styles.brand}>Reserva presencial</div>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Cerrar"
          >
            &#215;
          </button>
          <div className={styles.excRow}>
            <label htmlFor="nrm-exc">Excursión</label>
            <select
              id="nrm-exc"
              value={excursionId}
              onChange={(e) => {
                setExcursionId(e.target.value);
                setFecha("");
              }}
            >
              <option value="">— Elegí una excursión —</option>
              {excursions.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.steps}>
          {STEPS.map((lbl, i) => {
            const n = i + 1;
            const cls =
              n === step ? styles.stepActive : n < step ? styles.stepDone : "";
            return (
              <div key={lbl} className={`${styles.step} ${cls}`}>
                <div className={styles.bar} />
                <div className={styles.lbl}>{lbl}</div>
              </div>
            );
          })}
        </div>

        {/* STEP 1 — FECHA */}
        {step === 1 && (
          <div className={styles.pane}>
            <h2>Elegí la fecha de la salida</h2>
            <p className={styles.sub}>
              Disponibilidad en vivo para la excursión elegida.
            </p>
            {!excursionId ? (
              <div className={styles.calMsg}>
                Elegí una excursión arriba para ver el calendario.
              </div>
            ) : cal.kind === "cap_null" ? (
              <div className={styles.calMsg}>
                Esta excursión no está configurada para reservar.
              </div>
            ) : cal.kind === "error" ? (
              <div className={styles.calMsg}>
                No pudimos cargar la disponibilidad. El sistema la valida al
                crear.
              </div>
            ) : (
              <>
                <div className={styles.calHead}>
                  <button
                    className={styles.navBtn}
                    onClick={() => shiftMonth(-1)}
                    disabled={atMin}
                    aria-label="Mes anterior"
                  >
                    <Chevron dir="left" />
                  </button>
                  <span className={styles.mon}>{monthLabel(year, month0)}</span>
                  <button
                    className={styles.navBtn}
                    onClick={() => shiftMonth(1)}
                    disabled={atMax}
                    aria-label="Mes siguiente"
                  >
                    <Chevron dir="right" />
                  </button>
                </div>
                <div className={styles.dow}>
                  {DOW.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className={styles.grid}>
                  {cells.map((cell, i) => {
                    if (!cell)
                      return <div key={`e${i}`} className={styles.empty} />;
                    const st =
                      cal.kind === "loading" ? "available" : dayState(cell.iso);
                    const off = st === "soldout" || st === "past";
                    const sel = cell.iso === fecha;
                    return (
                      <button
                        key={cell.iso}
                        className={[
                          styles.day,
                          st === "last" ? styles.dayLast : "",
                          off ? styles.dayOff : "",
                          sel ? styles.daySel : "",
                        ].join(" ")}
                        disabled={off}
                        onClick={() => setFecha(cell.iso)}
                      >
                        {cell.day}
                        {!off && <span className={styles.dot} />}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.legend}>
                  <span>
                    <i style={{ background: "#3f7d5a" }} />
                    Disponible
                  </span>
                  <span>
                    <i style={{ background: "#d9a24a" }} />
                    Últimos lugares
                  </span>
                  <span>
                    <i style={{ background: "#ece8e0" }} />
                    Sin cupo
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2 — PASAJEROS */}
        {step === 2 && (
          <div className={styles.pane}>
            <h2>¿Quiénes viajan?</h2>
            <p className={styles.sub}>Cargá la cantidad por categoría.</p>
            <div>
              {categories.map((c) => {
                const u = unitArs(c);
                return (
                  <div key={c.code} className={styles.cat}>
                    <div>
                      <div className={styles.catNm}>{c.label}</div>
                      <div className={styles.catPr}>
                        {u == null
                          ? "—"
                          : u === 0
                            ? "Sin cargo"
                            : `${ars(u)} por persona`}
                      </div>
                    </div>
                    <div className={styles.spin}>
                      <button
                        className={styles.rmStep}
                        onClick={() => setQty(c.code, -1)}
                        disabled={(pax[c.code] ?? 0) <= 0}
                        aria-label={`Menos ${c.label}`}
                      >
                        &#8722;
                      </button>
                      <span className={styles.num}>{pax[c.code] ?? 0}</span>
                      <button
                        className={styles.rmStep}
                        onClick={() => setQty(c.code, 1)}
                        aria-label={`Más ${c.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.totBox}>
              <span className={styles.t1}>
                {totalPax} {totalPax === 1 ? "pasajero" : "pasajeros"}
              </span>
              <span className={styles.t2}>
                {totalArs == null ? "Sin tarifa vigente" : ars(totalArs)}
              </span>
            </div>
          </div>
        )}

        {/* STEP 3 — DATOS */}
        {step === 3 && (
          <div className={styles.pane}>
            <h2>Datos del titular</h2>
            <p className={styles.sub}>
              El email es obligatorio: ahí le llega el voucher al pasajero.
            </p>
            <div className={styles.field}>
              <label htmlFor="nrm-name">Nombre y apellido</label>
              <input
                id="nrm-name"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="nrm-email">
                Email <span style={{ color: "#b3261e" }}>*</span>
              </label>
              <input
                id="nrm-email"
                type="email"
                value={holderEmail}
                onChange={(e) => setHolderEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="nrm-phone">
                Teléfono <span className={styles.opt}>(opcional)</span>
              </label>
              <input
                id="nrm-phone"
                value={holderPhone}
                onChange={(e) => setHolderPhone(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="nrm-lodging">
                Alojamiento <span className={styles.opt}>(opcional)</span>
              </label>
              <input
                id="nrm-lodging"
                value={holderLodging}
                onChange={(e) => setHolderLodging(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* STEP 4 — PAGO */}
        {step === 4 && (
          <div className={styles.pane}>
            <h2>Cobro</h2>
            <p className={styles.payLine}>
              Total de la reserva:{" "}
              <b style={{ color: "var(--pine)" }}>
                {totalArs == null ? "—" : ars(totalArs)}
              </b>
            </p>
            <div className={styles.methods}>
              <MethodCard
                sel={method === "efectivo"}
                onClick={() => setMethod("efectivo")}
                icon={<Cash />}
                title="Efectivo"
                desc="Total o seña"
              />
              <MethodCard
                sel={method === "transferencia"}
                onClick={() => setMethod("transferencia")}
                icon={<Bank />}
                title="Transferencia"
                desc="Total o seña"
              />
              <MethodCard
                sel={method === "mercadopago"}
                onClick={() => setMethod("mercadopago")}
                icon={<Mp />}
                title="MercadoPago"
                desc="Link, cobra el total"
              />
              <MethodCard
                sel={method === "sinpago"}
                onClick={() => setMethod("sinpago")}
                icon={<Clock />}
                title="Cobrar después"
                desc="Pre-reserva, sin pago"
              />
            </div>

            {(method === "efectivo" || method === "transferencia") && (
              <div className={styles.amtBox}>
                <div className={styles.amtRow}>
                  <span className={styles.amtK}>Total de la reserva</span>
                  <span className={styles.amtV}>
                    {totalArs == null ? "—" : ars(totalArs)}
                  </span>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={sena}
                    onChange={(e) => {
                      setSena(e.target.checked);
                      if (e.target.checked && totalArs != null)
                        setSenaAmount(String(Math.round(totalArs)));
                    }}
                  />
                  Es una seña (pago parcial)
                </label>
                {sena && (
                  <>
                    <div className={styles.amtRow} style={{ marginTop: 12 }}>
                      <label className={styles.amtK} htmlFor="nrm-sena">
                        Monto que cobrás ahora
                      </label>
                      <input
                        id="nrm-sena"
                        className={styles.amtInput}
                        type="number"
                        min={0}
                        step={1000}
                        value={senaAmount}
                        onChange={(e) => setSenaAmount(e.target.value)}
                      />
                    </div>
                    <div className={styles.amtRow}>
                      <span className={styles.saldoK}>Saldo pendiente</span>
                      <span className={styles.saldoV}>{ars(saldoArs)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {method === "mercadopago" && (
              <div className={styles.mpBox}>
                <div className={styles.note}>
                  Al confirmar, se genera un link de MercadoPago por el{" "}
                  <b>total</b>. El cliente paga desde su teléfono; la reserva
                  queda pendiente hasta que MercadoPago confirme, y ahí sale el
                  voucher.
                </div>
              </div>
            )}

            {method === "sinpago" && (
              <div className={styles.mpBox}>
                <div className={styles.note}>
                  Se crea la reserva <b>sin pago</b> (pre-reserva, en hold).
                  Cobrás después desde la lista cuando recibas el pago.
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className={styles.err}>{error}</div>}

        <div className={styles.foot}>
          {step > 1 ? (
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => setStep(step - 1)}
              disabled={busy}
            >
              Volver
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
          )}
          {step < 4 ? (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && (!fecha || cal.kind === "loading")) ||
                (step === 2 && totalPax < 1) ||
                (step === 3 && !dataComplete)
              }
            >
              Continuar
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={finalize}
              disabled={!canFinalize || busy}
            >
              {busy
                ? "Procesando…"
                : method === "sinpago"
                  ? "Crear pre-reserva"
                  : method === "mercadopago"
                    ? "Generar link"
                    : "Cobrar y confirmar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  sel,
  onClick,
  icon,
  title,
  desc,
}: {
  sel: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.method} ${sel ? styles.methodSel : ""}`}
      onClick={onClick}
    >
      <span className={styles.methodIc}>{icon}</span>
      <span>
        <span className={styles.methodTitle}>{title}</span>
        <span className={styles.methodDesc}>{desc}</span>
      </span>
    </button>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="11"
        stroke="#fff"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <path
        d="M7 12.5l3.2 3.2L17 9"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Clock() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="6"
        width="19"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Bank() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 9l9-5 9 5M4 9v9m16-9v9M8 9v9m4-9v9m4-9v9M3 20h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Mp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#009EE3" />
      <path
        d="M6 13c3.6 3.4 8.4 3.4 12 0"
        stroke="#fff"
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
