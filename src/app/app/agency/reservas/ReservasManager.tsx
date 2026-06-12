"use client";
import { useMemo, useState } from "react";
import {
  RESERVA_STATUS_LABELS,
  type DepartureRow,
  type ExcursionRow,
  type PassengerCategoryRow,
  type ReservaRow,
} from "@/lib/agency/schemas";

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
  departures,
  excursions,
  categories,
  canCreate,
  isVendedor,
}: {
  initialReservas: ReservaRow[];
  departures: DepartureRow[];
  excursions: ExcursionRow[];
  categories: PassengerCategoryRow[];
  canCreate: boolean;
  isVendedor: boolean;
}) {
  const [reservas, setReservas] = useState<ReservaRow[]>(initialReservas);
  const [filterDep, setFilterDep] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const [formDep, setFormDep] = useState("");
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
  // Solo salidas reservables en el alta: abiertas y no pasadas (la RPC
  // igual rechaza — esto es UX; la autoridad es #24).
  const openDepartures = departures.filter(
    (d) => d.status === "open" && d.departure_date >= today,
  );

  const visible = reservas.filter(
    (r) => filterDep === "all" || r.departure_id === filterDep,
  );

  const totalPax = Object.values(pax).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0,
  );

  function startCreate() {
    setFormDep("");
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
      return "Cupo insuficiente para esa salida";
    if (body.error_code === "SALIDA_NO_DISPONIBLE")
      return "La salida no admite reservas";
    if (body.error_code === "TARIFA_NO_VIGENTE")
      return "La excursión no tiene tarifa vigente";
    if (httpStatus === 403) return "Sin permiso para esta acción";
    return body.message ?? "Error al crear la reserva";
  }

  async function submit() {
    setBusy(true);
    setStatus(null);
    const pasajeros = categories
      .map((c) => ({ categoria: c.code, qty: Number(pax[c.code] || 0) }))
      .filter((p) => p.qty > 0);
    const res = await fetch("/api/agency/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        departure_id: formDep,
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
                      {r.reservation_code}
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
              Salida
              <select
                value={formDep}
                onChange={(e) => setFormDep(e.target.value)}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">— Elegí una salida —</option>
                {openDepartures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {excursionName(d.excursion_id)} ·{" "}
                    {fmtDate(d.departure_date)} · {fmtTime(d.departure_time)} ·
                    cupo {d.capacity}
                  </option>
                ))}
              </select>
            </label>
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
                  formDep === "" ||
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
    </div>
  );
}
