"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RESERVA_STATUS_LABELS,
  type DepartureRow,
  type ExcursionRow,
  type PassengerCategoryRow,
  type ReservaRow,
} from "@/lib/agency/schemas";
import { MpChargeModal } from "./MpChargeModal";
import { NuevaReservaModal } from "./NuevaReservaModal";
import { AggregatedCalendar } from "../departures/AggregatedCalendar";
import styles from "./mp-cobro.module.css";

// R3 reservas. La ÚNICA escritura es POST /api/agency/reservas → RPC
// agency_crear_reserva (#24): jamás INSERT directo (contrato del ancla).
// PLATA: snapshot_* llega number|string (lesson P0 s49) → String() boundary.
// Colores: herencia del shell (lesson contraste branded R1, patrón Rates).

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
  const router = useRouter();
  const [reservas, setReservas] = useState<ReservaRow[]>(initialReservas);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [filterDep, setFilterDep] = useState<string>("all");
  // Drill del calendario (v1.1): excursion+fecha desde el day-detail del calendario.
  const [drill, setDrill] = useState<{
    excursionId: string;
    fecha: string;
  } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  const excursionName = useMemo(() => {
    const m = new Map(excursions.map((e) => [e.id, e.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [excursions]);

  const depById = useMemo(
    () => new Map(departures.map((d) => [d.id, d])),
    [departures],
  );

  const activeExcursions = useMemo(
    () => excursions.filter((e) => e.active),
    [excursions],
  );

  // Con drill activo (v1.1) filtramos por excursion+fecha: robusto a multi-departure
  // legacy (matchea TODAS las reservas de esa excursion ese dia). Sin drill, el filtro
  // por departure_id del dropdown queda igual.
  const visible = reservas.filter((r) => {
    if (drill) {
      const dep = depById.get(r.departure_id);
      return (
        !!dep &&
        dep.excursion_id === drill.excursionId &&
        dep.departure_date === drill.fecha
      );
    }
    return filterDep === "all" || r.departure_id === filterDep;
  });

  const detailHref = (id: string) => `${adminBase}/agency/reservas/${id}`;

  function handleDrill(excursionId: string, fecha: string) {
    setDrill({ excursionId, fecha });
    setFilterDep("all");
    setView("lista");
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="border-stone/50 inline-flex rounded-lg border p-0.5 text-sm">
            {(["lista", "calendario"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 capitalize ${
                  view === v ? "bg-bone text-onyx font-medium" : "text-ash"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {canCreate ? (
            <button
              onClick={() => setWizardOpen(true)}
              className="bg-bone text-onyx rounded px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              + Nueva reserva
            </button>
          ) : (
            <span className="bg-stone/40 rounded-full px-3 py-1 text-xs">
              Solo lectura
            </span>
          )}
        </div>
      </header>

      {view === "calendario" ? (
        <AggregatedCalendar mode="sales" onDrillToList={handleDrill} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterDep}
              onChange={(ev) => {
                setDrill(null);
                setFilterDep(ev.target.value);
              }}
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

          {drill && (
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-bone text-onyx inline-flex items-center gap-2 rounded-full px-3 py-1">
                Mostrando: {excursionName(drill.excursionId)} ·{" "}
                {fmtDate(drill.fecha)}
                <button
                  type="button"
                  onClick={() => setDrill(null)}
                  aria-label="Quitar filtro"
                  className="font-bold"
                >
                  ✕
                </button>
              </span>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="text-ash text-sm">
              No hay reservas
              {filterDep !== "all" || drill ? " de esta salida" : ""}.
              {canCreate && filterDep === "all" && !drill
                ? " Creá la primera con “+ Nueva reserva”."
                : ""}
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
                        onClick={() => router.push(detailHref(r.id))}
                        className={`border-stone/30 hover:bg-stone/10 cursor-pointer border-b transition-colors ${r.status === "cancelada" ? "opacity-50" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono font-semibold">
                          <Link
                            href={detailHref(r.id)}
                            onClick={(e) => e.stopPropagation()}
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
                        <td className="px-3 py-2">
                          {fmtMoney(r.snapshot_gross)}
                        </td>
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
                            ? new Date(r.hold_expires_at).toLocaleString(
                                "es-AR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "—"}
                        </td>
                        {canCharge && (
                          <td
                            className="px-3 py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.status === "pre_reserva" && !vencido ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPay(r);
                                  }}
                                  className="bg-onyx text-bone rounded px-3 py-1 text-xs hover:opacity-90"
                                >
                                  Registrar pago
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMpRes(r);
                                  }}
                                  className={styles.rowCta}
                                >
                                  <svg
                                    className={styles.rowMark}
                                    viewBox="0 0 24 24"
                                    aria-hidden
                                  >
                                    <circle
                                      cx="12"
                                      cy="12"
                                      r="12"
                                      fill="#009EE3"
                                    />
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
        </>
      )}

      {wizardOpen && (
        <NuevaReservaModal
          excursions={activeExcursions}
          categories={categories}
          onClose={() => setWizardOpen(false)}
          onCreated={() => window.location.reload()}
        />
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
