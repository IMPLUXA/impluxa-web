"use client";
import { useMemo, useState } from "react";
import {
  DEPARTURE_STATUS_LABELS,
  type DepartureRow,
  type ExcursionRow,
} from "@/lib/agency/schemas";

// R1 salidas/cupo. canEdit espeja la RLS (encargado + dueno_admin); con
// false la UI es solo-lectura con chip — la autoridad real es la RLS (un
// write forzado igual rebota 403 y se muestra el mensaje).

type FormState = {
  excursion_id: string;
  departure_date: string;
  no_time: boolean;
  departure_time: string;
  capacity: string;
};

const EMPTY_FORM: FormState = {
  excursion_id: "",
  departure_date: "",
  no_time: false,
  departure_time: "09:00",
  capacity: "20",
};

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC", // departure_date es DATE puro: formatear sin corrimiento TZ
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

export function DeparturesManager({
  initialDepartures,
  excursions,
  canEdit,
}: {
  initialDepartures: DepartureRow[];
  excursions: ExcursionRow[];
  canEdit: boolean;
}) {
  const [departures, setDepartures] =
    useState<DepartureRow[]>(initialDepartures);
  const [filter, setFilter] = useState<string>("all");
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const excursionName = useMemo(() => {
    const m = new Map(excursions.map((e) => [e.id, e.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [excursions]);

  const today = todayIso();
  const visible = departures.filter(
    (d) =>
      (filter === "all" || d.excursion_id === filter) &&
      (showPast || d.departure_date >= today),
  );

  function errorMessage(res: Response): string {
    if (res.status === 403) return "Sin permiso para esta acción";
    if (res.status === 409)
      return "Ya existe una salida de esa excursión para esa fecha y horario";
    return "Error al guardar";
  }

  function startCreate() {
    setForm({ ...EMPTY_FORM, departure_date: today });
    setStatus(null);
    setOpen(true);
  }

  async function submit() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/agency/departures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        excursion_id: form.excursion_id,
        departure_date: form.departure_date,
        departure_time: form.no_time ? null : form.departure_time,
        capacity: Number(form.capacity),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(errorMessage(res));
      return;
    }
    const { data } = await res.json();
    setDepartures((prev) =>
      [...prev, data as DepartureRow].sort(
        (a, b) =>
          a.departure_date.localeCompare(b.departure_date) ||
          (a.departure_time ?? "").localeCompare(b.departure_time ?? ""),
      ),
    );
    setOpen(false);
  }

  async function patch(d: DepartureRow, fields: Record<string, unknown>) {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/agency/departures", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: d.id, ...fields }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(errorMessage(res));
      return;
    }
    const { data } = await res.json();
    setDepartures((prev) =>
      prev.map((x) => (x.id === data.id ? (data as DepartureRow) : x)),
    );
  }

  async function editCapacity(d: DepartureRow) {
    const raw = window.prompt(
      `Cupo para ${excursionName(d.excursion_id)} ${fmtDate(d.departure_date)}:`,
      String(d.capacity),
    );
    if (raw === null) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 999) {
      setStatus("Cupo inválido (entero entre 0 y 999)");
      return;
    }
    await patch(d, { capacity: n });
  }

  async function cancel(d: DepartureRow) {
    if (
      !window.confirm(
        `¿Cancelar la salida de ${excursionName(d.excursion_id)} del ${fmtDate(d.departure_date)}? Esta acción no se puede deshacer desde acá.`,
      )
    )
      return;
    await patch(d, { status: "cancelled" });
  }

  const activeExcursions = excursions.filter((e) => e.active);

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Salidas y cupo</h1>
        {canEdit ? (
          <button
            onClick={startCreate}
            className="bg-bone text-onyx rounded px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + Nueva salida
          </button>
        ) : (
          <span className="bg-stone/40 rounded-full px-3 py-1 text-xs">
            Solo lectura
          </span>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(ev) => setFilter(ev.target.value)}
          className="border-stone rounded border px-3 py-1.5 text-sm"
        >
          <option value="all">Todas las excursiones</option>
          {excursions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.active ? "" : " (archivada)"}
            </option>
          ))}
        </select>
        <label className="text-ash ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showPast}
            onChange={(ev) => setShowPast(ev.target.checked)}
          />
          Ver salidas pasadas
        </label>
      </div>

      {!open && status && <div className="text-ash text-sm">{status}</div>}

      {visible.length === 0 ? (
        <p className="text-ash text-sm">
          No hay salidas{filter !== "all" ? " de esta excursión" : ""}
          {showPast ? "" : " próximas"}.
          {canEdit ? " Creá la primera con “+ Nueva salida”." : ""}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ash border-stone/50 border-b text-left text-xs uppercase">
                <th className="px-3 py-2">Excursión</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Horario</th>
                <th className="px-3 py-2">Cupo</th>
                <th className="px-3 py-2">Estado</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr
                  key={d.id}
                  className={`border-stone/30 border-b ${d.status === "cancelled" ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {excursionName(d.excursion_id)}
                  </td>
                  <td className="px-3 py-2">{fmtDate(d.departure_date)}</td>
                  <td className="px-3 py-2">{fmtTime(d.departure_time)}</td>
                  <td className="px-3 py-2">{d.capacity}</td>
                  <td className="px-3 py-2">
                    {/* Chips neutros del patrón Rates: legibles en shell
                        oscuro Y branded claro (emerald/red-300 eran solo-
                        shell-oscuro, misma familia que el bug del modal). */}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        d.status === "open"
                          ? "bg-bone text-onyx font-medium"
                          : d.status === "closed"
                            ? "bg-stone/40 text-ash"
                            : "bg-stone/20 text-ash line-through"
                      }`}
                    >
                      {DEPARTURE_STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      {d.status !== "cancelled" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => editCapacity(d)}
                            disabled={busy}
                            className="bg-stone/40 rounded px-3 py-1 text-xs hover:opacity-90"
                          >
                            Cupo
                          </button>
                          <button
                            onClick={() =>
                              patch(d, {
                                status: d.status === "open" ? "closed" : "open",
                              })
                            }
                            disabled={busy}
                            className="bg-stone/40 rounded px-3 py-1 text-xs hover:opacity-90"
                          >
                            {d.status === "open" ? "Cerrar" : "Reabrir"}
                          </button>
                          <button
                            onClick={() => cancel(d)}
                            disabled={busy}
                            className="bg-stone/20 rounded px-3 py-1 text-xs hover:opacity-90"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          {/* SIN text-onyx fijo (bug walk CEO R1): bajo el admin BRANDED las
              vars se redefinen light-content (onyx = el crema del fondo) y el
              texto quedaba invisible. Patrón RatesManager: el card hereda el
              color de texto del shell — correcto en ambos mundos. */}
          <div className="bg-marble w-full max-w-lg space-y-4 rounded-lg p-6">
            <h2 className="text-lg font-bold">Nueva salida</h2>
            <label className="block text-sm">
              Excursión
              <select
                value={form.excursion_id}
                onChange={(e) =>
                  setForm({ ...form, excursion_id: e.target.value })
                }
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">— Elegí una excursión —</option>
                {activeExcursions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <label className="block flex-1 text-sm">
                Fecha
                <input
                  type="date"
                  value={form.departure_date}
                  onChange={(e) =>
                    setForm({ ...form, departure_date: e.target.value })
                  }
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block flex-1 text-sm">
                Cupo
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            </div>
            <div className="flex items-end gap-3">
              <label className="block flex-1 text-sm">
                Horario
                <input
                  type="time"
                  value={form.departure_time}
                  disabled={form.no_time}
                  onChange={(e) =>
                    setForm({ ...form, departure_time: e.target.value })
                  }
                  className="border-stone mt-1 w-full rounded border px-3 py-2 disabled:opacity-50"
                />
              </label>
              <label className="flex items-center gap-2 pb-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.no_time}
                  onChange={(e) =>
                    setForm({ ...form, no_time: e.target.checked })
                  }
                />
                Sin horario fijo
              </label>
            </div>
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
                  form.excursion_id === "" ||
                  form.departure_date === "" ||
                  form.capacity.trim() === "" ||
                  (!form.no_time && form.departure_time === "")
                }
                className="bg-onyx text-bone rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
