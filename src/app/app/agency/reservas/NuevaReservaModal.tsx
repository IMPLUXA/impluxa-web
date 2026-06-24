"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DOW,
  buildMonthCells,
  monthLabel,
  monthRange,
  todayIso,
} from "@/lib/agency/calendar-dates";
import { availFromResponse } from "@/lib/agency/alta-availability";
import type { ExcursionRow, PassengerCategoryRow } from "@/lib/agency/schemas";
import styles from "./NuevaReservaModal.module.css";

// Alta presencial branded (paridad con el wizard publico) — CORTE A: P1 Fecha /
// P2 Pasajeros / P3 Datos + crear via POST /api/agency/reservas (sin pago; el
// cobro sigue en la lista hasta el Corte B, que foldea Pago + Voucher).
//
// Aislado: componente agency, llama el route existente (que es la autoridad del
// cupo y del snapshot). NO toca templates/eventos ni lib/public. Reusa
// lib/agency/{calendar-dates,alta-availability,schemas}.

const LAST_SPOTS = 5; // ponytail: umbral "ultimos lugares" (amber). El motor #24 es la autoridad real.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DayState = "available" | "last" | "soldout" | "past";

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

export function NuevaReservaModal({
  excursions,
  categories,
  onClose,
  onCreated,
}: {
  excursions: ExcursionRow[];
  categories: PassengerCategoryRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = todayIso();
  const [excursionId, setExcursionId] = useState("");
  const [step, setStep] = useState(1); // 1 Fecha · 2 Pasajeros · 3 Datos
  const [done, setDone] = useState<{
    code: string;
    gross: number | null;
  } | null>(null);

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

  // estado visual de un dia, derivado del read-model (single source via availFromResponse).
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
    return "soldout"; // cap_null/idle/loading/error no deberian llegar por-celda
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

  const canCreate =
    !!excursionId &&
    !!fecha &&
    totalPax >= 1 &&
    holderName.trim() !== "" &&
    EMAIL_RE.test(holderEmail.trim());

  function errorMessage(
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

  async function submit() {
    setBusy(true);
    setError(null);
    const pasajeros = categories
      .map((c) => ({ categoria: c.code, qty: pax[c.code] ?? 0 }))
      .filter((p) => p.qty > 0);
    const res = await fetch("/api/agency/reservas", {
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
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(errorMessage(body, res.status));
      return;
    }
    // 201 sin reservation_code = envelope roto: no lo escondemos (anti silent-failure).
    if (!body.reservation_code) {
      setError(
        "La reserva se creó pero no llegó el código. Buscala en la lista.",
      );
      return;
    }
    // El server es la autoridad del total: mostramos snapshot_gross si el route lo
    // devuelve (no inventamos precio).
    const gross =
      body.snapshot_gross != null ? Number(String(body.snapshot_gross)) : null;
    setDone({
      code: body.reservation_code,
      gross: Number.isFinite(gross as number) ? (gross as number) : null,
    });
  }

  const excursionName = useMemo(() => {
    const m = new Map(excursions.map((e) => [e.id, e.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [excursions]);

  // ---- confirmacion (Corte A: pre-reserva, sin pago) ----
  if (done) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true">
        <div className={styles.modal}>
          <div className={styles.pane}>
            <div className={styles.vletter}>
              <Check />
              <h2>Pre-reserva creada</h2>
              <p>
                Queda en hold. Cobrá desde la lista (Registrar pago / Cobrar con
                MercadoPago); el voucher sale al confirmar el cobro.
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
            {done.gross != null && (
              <div className={styles.vrow}>
                <span className={styles.k}>Total</span>
                <span className={styles.v}>
                  {new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    maximumFractionDigits: 0,
                  }).format(done.gross)}
                </span>
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
          {["Fecha", "Pasajeros", "Datos"].map((lbl, i) => {
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
              {categories.map((c) => (
                <div key={c.code} className={styles.cat}>
                  <div>
                    <div className={styles.catNm}>{c.label}</div>
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
              ))}
            </div>
            <div className={styles.totBox}>
              <span className={styles.t1}>
                {totalPax} {totalPax === 1 ? "pasajero" : "pasajeros"}
              </span>
              <span className={styles.t2}>
                Total: lo calcula el sistema al crear
                <br />
                (según la tarifa vigente)
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
          {step < 3 ? (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && (!fecha || cal.kind === "loading")) ||
                (step === 2 && totalPax < 1)
              }
            >
              Continuar
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={submit}
              disabled={!canCreate || busy}
            >
              {busy ? "Creando…" : "Crear reserva"}
            </button>
          )}
        </div>
      </div>
    </div>
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
