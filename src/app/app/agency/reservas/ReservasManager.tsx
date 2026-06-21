"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  RESERVA_STATUS_LABELS,
  type DepartureRow,
  type ExcursionRow,
  type PassengerCategoryRow,
  type ReservaRow,
} from "@/lib/agency/schemas";
import {
  type Avail,
  availBlocks,
  availFromResponse,
  availLabel,
} from "@/lib/agency/alta-availability";
import { MpChargeModal } from "./MpChargeModal";
import styles from "./mp-cobro.module.css";

// R3 reservas. La ÚNICA escritura es POST /api/agency/reservas → RPC
// agency_crear_reserva (#24): jamás INSERT directo (contrato del ancla).
// PLATA: snapshot_* llega number|string (lesson P0 s49) → String() boundary.
// Colores: herencia del shell (lesson contraste branded R1, patrón Rates).

type PaxQty = Record<string, string>; // code -> qty (string para inputs)

const arsPrice = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function fmtMoney(raw: number | string): string {
  const n = Number(String(raw));
  return Number.isFinite(n) ? arsPrice.format(n) : "—";
}

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC", // DATE puro: sin corrimiento TZ
});

function fmtDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : "Sin horario fijo";
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Estado a MOSTRAR: pre_reserva con hold vencido se señala derivado en la
// UI (el dato no se muta acá: el barredor C11/los filtros del motor son la
// autoridad; esto es señalización para el operador).
function holdVencido(r: ReservaRow): boolean {
  return (
    r.status === "pre_reserva" &&
    r.hold_expires_at !== null &&
    new Date(r.hold_expires_at).getTime() <= Date.now()
  );
}

export function ReservasManager({
  initialReservas,
  adminBase,
  departures,
  excursions,
  categories,
  canCreate,
  canCharge,
  paymentMethods,
  isVendedor,
}: {
  initialReservas: ReservaRow[];
  adminBase: string;
  departures: DepartureRow[];
  excursions: ExcursionRow[];
  categories: PassengerCategoryRow[];
  canCreate: boolean;
  canCharge: boolean;
  paymentMethods: { code: string; label: string }[];
  isVendedor: boolean;
}) {
  const [reservas, setReservas] = useState<ReservaRow[]>(initialReservas);
  const [filterDep, setFilterDep] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  // C7.2 — cobro manual presencial (efectivo/transferencia)
  const [payRes, setPayRes] = useState<ReservaRow | null>(null);
  const [payMethod, setPayMethod] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payConfirm, setPayConfirm] = useState(true);
  const [payBusy, setPayBusy] = useState(false);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const [payIdemKey, setPayIdemKey] = useState("");

  // C2 — cobro MercadoPago (Checkout Pro): qué reserva tiene el modal MP abierto.
  const [mpRes, setMpRes] = useState<ReservaRow | null>(null);

  const [formExcursion, setFormExcursion] = useState("");
  const [formFecha, setFormFecha] = useState("");
  const [avail, setAvail] = useState<Avail>({ state: "idle" });
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [holderPhone, setHolderPhone] = useState("");
  const [holderLodging, setHolderLodging] = useState("");
  const [pax, setPax] = useState<PaxQty>({});

  const excursionName = useMemo(() => {
    const m = new Map(excursions.map((e) => [e.id, e.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [excursions]);

  const depById = useMemo(
    () => new Map(departures.map((d) => [d.id, d])),
    [departures],
  );

  const today = todayIso();
  const maxDate = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 365);
    return d.toISOString().slice(0, 10);
  }, [today]);
  const activeExcursions = useMemo(
    () => excursions.filter((e) => e.active),
    [excursions],
  );

  // F1c — disponibilidad del (excursion, fecha) elegido: UNA sola fuente, el
  // read-model compartido (single-day). Pre-aviso de UX; el motor #24 es la
  // autoridad final (re-chequea bajo su advisory-lock al crear).
  useEffect(() => {
    if (!open || !formExcursion || !formFecha) {
      setAvail({ state: "idle" });
      return;
    }
    let alive = true;
    setAvail({ state: "loading" });
    fetch(
      `/api/agency/departures/calendario?excursion_id=${formExcursion}&from=${formFecha}&to=${formFecha}`,
    )
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (alive) setAvail(availFromResponse(body, formFecha, r.ok));
      })
      .catch(() => {
        if (alive) setAvail({ state: "error" });
      });
    return () => {
      alive = false;
    };
  }, [open, formExcursion, formFecha]);

  const availInfo = availLabel(avail);
  const availBlocked = availBlocks(avail);

  const visible = reservas.filter(
    (r) => filterDep === "all" || r.departure_id === filterDep,
  );

  const totalPax = Object.values(pax).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0,
  );

  function startCreate() {
    setFormExcursion("");
    setFormFecha("");
    setAvail({ state: "idle" });
    setHolderName("");
    setHolderEmail("");
    setHolderPhone("");
    setHolderLodging("");
    setPax({});
    setStatus(null);
    setCreatedCode(null);
    setOpen(true);
  }

  function errorMessage(
    body: { error_code?: string; message?: string },
    httpStatus: number,
  ): string {
    if (body.error_code === "CUPO_INSUFICIENTE")
      return "Cupo insuficiente para esa fecha";
    if (body.error_code === "SALIDA_NO_DISPONIBLE")
      return "Ese día no admite reservas (cerrado o sin cupo)";
    if (body.error_code === "SALIDA_INEXISTENTE")
      return "La excursión no está disponible";
    if (body.error_code === "TARIFA_NO_VIGENTE")
      return "La excursión no tiene tarifa vigente";
    if (body.error_code === "CATEGORIA_INVALIDA")
      return "Categoría de pasajero inválida";
    if (httpStatus === 403) return "Sin permiso para esta acción";
    return body.message ?? "Error al crear la reserva";
  }

  async function submit() {
    setBusy(true);
    setStatus(null);
    const pasajeros = categories
      .map((c) => ({ categoria: c.code, qty: Number(pax[c.code] || 0) }))
      .filter((p) => p.qty > 0);
    // F1c: el alta elige (excursion, fecha) DIRECTO sobre el modelo abierto-por-
    // defecto. El motor #24 materializa el ancla del dia y es la autoridad del cupo.
    const res = await fetch("/api/agency/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        excursion_id: formExcursion,
        departure_date: formFecha,
        holder_name: holderName,
        holder_email: holderEmail.trim() || undefined,
        holder_phone: holderPhone.trim() || undefined,
        holder_lodging: holderLodging.trim() || undefined,
        pasajeros,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(errorMessage(body, res.status));
      return;
    }
    // Refrescamos del server (la fila real con snapshot) en vez de armarla
    // a mano: recarga simple de la page = fuente de verdad.
    setCreatedCode(body.reservation_code ?? null);
    setOpen(false);
    window.location.reload();
  }

  function openPay(r: ReservaRow) {
    setPayRes(r);
    setPayMethod(paymentMethods[0]?.code ?? "");
    // boundary number|string del snapshot (lesson P0 s49); el monto autoritativo es
    // snapshot_gross, B1 lo valida server-side.
    setPayAmount(String(r.snapshot_gross ?? ""));
    setPayConfirm(true);
    setPayStatus(null);
    // key por INTENTO (reusado en reintentos del mismo dialog) = idempotencia real,
    // no sólo el busy. Defensa en profundidad con pagos_tenant_idem_uk.
    setPayIdemKey(crypto.randomUUID());
  }

  function payErrorMessage(
    body: { error_code?: string; message?: string },
    httpStatus: number,
  ): string {
    switch (body.error_code) {
      case "MONTO_EXCEDE_SALDO":
        return "El monto excede el saldo pendiente";
      case "HOLD_VENCIDO":
        return "El hold de la reserva venció";
      case "METODO_PAGO_INVALIDO":
        return "Método de pago inválido";
      case "ESTADO_INVALIDO":
        return "La reserva no está en pre-reserva";
      case "RESERVA_INEXISTENTE":
        return "Reserva inexistente";
      case "IDEMPOTENCY_CONFLICT":
        return "Ese comprobante ya se usó en otra reserva";
      case "PARAMS_INVALIDOS":
        return body.message ?? "Datos inválidos";
    }
    if (httpStatus === 403) return "Sin permiso para cobrar";
    return body.message ?? "Error al registrar el pago";
  }

  async function submitPay() {
    if (!payRes) return;
    setPayBusy(true);
    setPayStatus(null);
    const res = await fetch(`/api/agency/reservas/${payRes.id}/pago`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method_code: payMethod,
        amount: Number(payAmount), // número JSON (el RPC exige jsonb number)
        idempotency_key: payIdemKey,
        confirm: payConfirm,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setPayBusy(false);
    if (!res.ok) {
      setPayStatus(payErrorMessage(body, res.status));
      return;
    }
    // ok (incluye idempotent_replay = ya aplicado a ESTA reserva) → recargar (fuente de verdad).
    window.location.reload();
  }

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Reservas</h1>
        {canCreate ? (
          <button
            onClick={startCreate}
            className="bg-bone text-onyx rounded px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + Nueva reserva
          </button>
        ) : (
          <span className="bg-stone/40 rounded-full px-3 py-1 text-xs">
            Solo lectura
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterDep}
          onChange={(ev) => setFilterDep(ev.target.value)}
          className="border-stone rounded border px-3 py-1.5 text-sm"
        >
          <option value="all">Todas las salidas</option>
          {departures.map((d) => (
            <option key={d.id} value={d.id}>
              {excursionName(d.excursion_id)} · {fmtDate(d.departure_date)}
            </option>
          ))}
        </select>
        {isVendedor && (
          <span className="bg-stone/40 text-ash ml-auto rounded-full px-3 py-1 text-xs">
            Viendo solo tus reservas
          </span>
        )}
      </div>

      {createdCode && (
        <div className="border-stone rounded-lg border p-4 text-sm">
          Reserva creada. Código:{" "}
          <span className="bg-bone text-onyx rounded px-2 py-0.5 font-mono text-base font-bold">
            {createdCode}
          </span>
        </div>
      )}

      {!open && status && <div className="text-ash text-sm">{status}</div>}

      {visible.length === 0 ? (
        <p className="text-ash text-sm">
          No hay reservas{filterDep !== "all" ? " de esta salida" : ""}.
          {canCreate ? " Creá la primera con “+ Nueva reserva”." : ""}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ash border-stone/50 border-b text-left text-xs uppercase">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Excursión / salida</th>
                <th className="px-3 py-2">Titular</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Hold hasta</th>
                {canCharge && <th className="px-3 py-2">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const dep = depById.get(r.departure_id);
                const vencido = holdVencido(r);
                return (
                  <tr
                    key={r.id}
                    className={`border-stone/30 border-b ${r.status === "cancelada" ? "opacity-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold">
                      <Link
                        href={`${adminBase}/agency/reservas/${r.id}`}
                        className="hover:underline"
                      >
                        {r.reservation_code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {dep ? (
                        <>
                          {excursionName(dep.excursion_id)}
                          <span className="text-ash">
                            {" "}
                            · {fmtDate(dep.departure_date)} ·{" "}
                            {fmtTime(dep.departure_time)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{r.holder_name}</td>
                    <td className="px-3 py-2">{fmtMoney(r.snapshot_gross)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === "reserva"
                            ? "bg-bone text-onyx font-medium"
                            : vencido
                              ? "bg-stone/20 text-ash line-through"
                              : "bg-stone/40 text-ash"
                        }`}
                      >
                        {vencido
                          ? "Hold vencido"
                          : RESERVA_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="text-ash px-3 py-2 text-xs">
                      {r.hold_expires_at && r.status === "pre_reserva"
                        ? new Date(r.hold_expires_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    {canCharge && (
                      <td className="px-3 py-2">
                        {r.status === "pre_reserva" && !vencido ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => openPay(r)}
                              className="bg-onyx text-bone rounded px-3 py-1 text-xs hover:opacity-90"
                            >
                              Registrar pago
                            </button>
                            <button
                              onClick={() => setMpRes(r)}
                              className={styles.rowCta}
                            >
                              <svg
                                className={styles.rowMark}
                                viewBox="0 0 24 24"
                                aria-hidden
                              >
                                <circle cx="12" cy="12" r="12" fill="#009EE3" />
                                <path
                                  d="M6 13.2c3.6 3.4 8.4 3.4 12 0"
                                  stroke="#fff"
                                  strokeWidth="2.1"
                                  fill="none"
                                  strokeLinecap="round"
                                />
                              </svg>
                              Cobrar con MercadoPago
                            </button>
                          </div>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          {/* Card SIN color de texto fijo: hereda del shell (lesson R1). */}
          <div className="bg-marble max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg p-6">
            <h2 className="text-lg font-bold">Nueva reserva</h2>
            <label className="block text-sm">
              Excursión
              <select
                value={formExcursion}
                onChange={(e) => setFormExcursion(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">— Elegí una excursión —</option>
                {activeExcursions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Fecha
              <input
                type="date"
                value={formFecha}
                min={today}
                max={maxDate}
                disabled={formExcursion === ""}
                onChange={(e) => setFormFecha(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2 disabled:opacity-50"
              />
            </label>
            {formExcursion !== "" && (
              <div
                className={`rounded-md px-3 py-2 text-[13px] ${
                  availInfo.tone === "open"
                    ? "bg-bone/30 text-onyx font-medium"
                    : availInfo.tone === "limited"
                      ? "font-medium text-[#b48448]"
                      : availInfo.tone === "closed"
                        ? "bg-stone/20 text-ash"
                        : "text-ash"
                }`}
              >
                {availInfo.text}
              </div>
            )}
            <label className="block text-sm">
              Titular
              <input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1 text-sm">
                Email (opcional)
                <input
                  value={holderEmail}
                  onChange={(e) => setHolderEmail(e.target.value)}
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block flex-1 text-sm">
                Teléfono (opcional)
                <input
                  value={holderPhone}
                  onChange={(e) => setHolderPhone(e.target.value)}
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              Alojamiento (opcional)
              <input
                value={holderLodging}
                onChange={(e) => setHolderLodging(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <fieldset className="border-stone rounded border p-3">
              <legend className="px-1 text-sm font-medium">Pasajeros</legend>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((c) => (
                  <label key={c.code} className="block text-sm">
                    {c.label}
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={pax[c.code] ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setPax({ ...pax, [c.code]: e.target.value })
                      }
                      className="border-stone mt-1 w-full rounded border px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            {status && <div className="text-sm">{status}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={
                  busy ||
                  formExcursion === "" ||
                  formFecha === "" ||
                  availBlocked ||
                  holderName.trim() === "" ||
                  totalPax < 1
                }
                className="bg-onyx text-bone rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy ? "Reservando…" : "Crear reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {payRes && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          {/* Card hereda el color del shell (lesson R1). */}
          <div className="bg-marble w-full max-w-md space-y-4 rounded-lg p-6">
            <h2 className="text-lg font-bold">Registrar pago</h2>
            <p className="text-ash text-sm">
              {payRes.reservation_code} · {payRes.holder_name} · total{" "}
              {fmtMoney(payRes.snapshot_gross)}
            </p>
            <label className="block text-sm">
              Método
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              >
                {paymentMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Monto
              <input
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={payConfirm}
                onChange={(e) => setPayConfirm(e.target.checked)}
              />
              Confirmar la reserva (pre-reserva → reserva)
            </label>
            {payStatus && <div className="text-sm">{payStatus}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPayRes(null)}
                disabled={payBusy}
                className="rounded px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={submitPay}
                disabled={payBusy || payMethod === "" || Number(payAmount) <= 0}
                className="bg-onyx text-bone rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                {payBusy ? "Registrando…" : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mpRes && (
        <MpChargeModal reserva={mpRes} onClose={() => setMpRes(null)} />
      )}
    </div>
  );
}
