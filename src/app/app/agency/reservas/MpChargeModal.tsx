"use client";
import { useState } from "react";
import styles from "./mp-cobro.module.css";
import type { ReservaRow } from "@/lib/agency/schemas";

// C2 — modal de cobro MercadoPago (piel premium dir. B, oscuro). Self-contained: maneja su
// submit a /api/agency/reservas/{id}/pago-mp, el estado de carga ("Abriendo Checkout Pro") y el
// mapa de errores. On ok redirige a init_point (Checkout Pro). La confirmación real es ASÍNCRONA
// vía webhook -> esta UI NO afirma "pagado"/"confirmado". El monto es editable, default = total;
// el techo de saldo lo enforza el RPC (MONTO_EXCEDE_SALDO), NO validación client-side frágil
// (sólo piso > 0). NOTA money: la plata va 100% a la cuenta del dueño (sin marketplace_fee).

const ERR: Record<string, string> = {
  MP_NO_CONECTADO:
    "Esta cuenta no tiene MercadoPago conectado. Andá a Cobros y conectá la cuenta del dueño primero.",
  MP_PREFERENCE_FAILED:
    "MercadoPago rechazó la creación del cobro. Probá de nuevo en un momento.",
  MONTO_EXCEDE_SALDO: "El monto supera el saldo pendiente de la reserva.",
  HOLD_VENCIDO: "El hold de la pre-reserva venció. Refrescá la lista.",
  ESTADO_INVALIDO: "La reserva ya no está en estado de pre-reserva.",
  E_ROLE: "No tenés permiso para cobrar esta reserva.",
  E_ORIGIN: "Origen no válido. Refrescá la página e intentá de nuevo.",
  E_NON_PROD: "El cobro con MercadoPago sólo corre en producción.",
};

function errMsg(code: string | undefined, status: number): string {
  if (code && ERR[code]) return ERR[code];
  if (status === 403) return "No autorizado para esta acción.";
  return "No se pudo generar el link de pago. Probá de nuevo.";
}

function fmtTotal(raw: number | string): string {
  const n = Number(String(raw));
  return Number.isFinite(n)
    ? n.toLocaleString("es-AR", { maximumFractionDigits: 2 })
    : "0";
}

export function MpChargeModal({
  reserva,
  onClose,
}: {
  reserva: ReservaRow;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(Number(reserva.snapshot_gross)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountValid = Number.isFinite(Number(amount)) && Number(amount) > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agency/reservas/${reserva.id}/pago-mp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (res.ok && typeof body.init_point === "string") {
        // Navega al Checkout Pro de MercadoPago (no se vuelve; deja busy=true).
        window.location.assign(body.init_point);
        return;
      }
      // El route devuelve el codigo en `error_code` (RPC + MP_*) o en `code` (guardas
      // 403 E_ROLE/E_ORIGIN/E_NON_PROD). Leer ambos (Two-Pass cold C2).
      const code =
        typeof body.error_code === "string"
          ? body.error_code
          : typeof body.code === "string"
            ? body.code
            : undefined;
      setBusy(false);
      setError(errMsg(code, res.status));
    } catch {
      setBusy(false);
      setError("No se pudo conectar. Revisá tu conexión y probá de nuevo.");
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Cobrar con MercadoPago"
    >
      <div className={styles.modal}>
        <span className={styles.badge}>
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="12" fill="#009EE3" />
            <path
              d="M6 13.2c3.6 3.4 8.4 3.4 12 0"
              stroke="#fff"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          MercadoPago · Checkout Pro
        </span>
        <h2 className={styles.title}>
          Cobrar reserva {reserva.reservation_code}
        </h2>
        <p className={styles.ctx}>
          {reserva.holder_name} · total ARS {fmtTotal(reserva.snapshot_gross)}
        </p>

        <div className={styles.amountWrap}>
          <span className={styles.amountLbl}>Monto a cobrar</span>
          <div className={styles.amountRow}>
            <span className={styles.cur}>ARS</span>
            <input
              className={styles.amountInput}
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              aria-label="Monto a cobrar"
            />
          </div>
        </div>
        <p className={styles.help}>
          Pre-cargado con el total. Editable para cobrar una seña/parcial; el
          servidor rechaza si supera el saldo.
        </p>

        {/* Eco del monto PARSEADO: si tipean "72.000" (separador de miles), Number()=72;
            mostrar el valor real evita el undercharge silencioso (Two-Pass cold C2). */}
        <p className={styles.confirm}>
          Se generará un cobro por{" "}
          <b>ARS {fmtTotal(amountValid ? Number(amount) : 0)}</b>
        </p>

        {error && <div className={styles.err}>{error}</div>}

        {busy ? (
          <div className={styles.loading}>
            <span className={styles.bar}>
              <i />
            </span>
            <span className={styles.loadtxt}>
              Abriendo Checkout Pro, no cierres esta pestaña…
            </span>
          </div>
        ) : (
          <div className={styles.foot}>
            <button className={styles.ghost} onClick={onClose}>
              Cancelar
            </button>
            <button
              className={styles.cta}
              onClick={submit}
              disabled={!amountValid}
            >
              Generar link de pago
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
