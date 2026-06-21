"use client";
import { useEffect, useMemo, useState } from "react";
import type {
  CalendarDay,
  CalendarLegacySlot,
  CalendarResponse,
  ExcursionRow,
} from "@/lib/agency/schemas";

// F1b.1 — calendario read-only del modelo abierto-por-defecto. Scopeado a UNA excursion,
// vista mensual navegable (no pinta 365 filas). El dia virgen (sin fila) se muestra abierto
// cap=capacity_default; los estados (abierto/limitado/cerrado/con-reservas) salen del read-model
// compartido `agency_calendario_salidas`. SOLO LECTURA: cerrar/limitar/reabrir llegan en F1b.2.
//
// Paleta PV del mockup aprobado (sand/pine/copper) via arbitrary values — el widget es una card
// clara autocontenida, legible bajo el shell branded (PV) y el shell generico (/app).

const DOW = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}
// Lun-first offset del 1ro del mes (getUTCDay: 0=Dom..6=Sab -> 0=Lun..6=Dom).
function firstOffset(y: number, m0: number): number {
  return (new Date(Date.UTC(y, m0, 1)).getUTCDay() + 6) % 7;
}
const monthFmt = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayLongFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
function monthLabel(y: number, m0: number): string {
  return monthFmt.format(new Date(Date.UTC(y, m0, 1)));
}
function dayLabel(iso: string): string {
  return dayLongFmt.format(new Date(`${iso}T00:00:00Z`));
}

type DayCell = {
  iso: string;
  day: number;
  past: boolean;
  cap: number;
  taken: number;
  restante: number;
  estado: "open" | "limited" | "closed";
  legacyCount: number;
};

export function SalidasCalendar({
  excursions,
  canEdit,
}: {
  excursions: ExcursionRow[];
  canEdit: boolean;
}) {
  const activeExcursions = useMemo(
    () => excursions.filter((e) => e.active),
    [excursions],
  );
  const [excursionId, setExcursionId] = useState<string>(
    activeExcursions[0]?.id ?? excursions[0]?.id ?? "",
  );
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bump -> refetch del mes tras una accion
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [limitMode, setLimitMode] = useState(false);
  const [limitValue, setLimitValue] = useState("");

  const today = todayIso();

  useEffect(() => {
    if (!excursionId) return;
    const from = `${year}-${pad2(month0 + 1)}-01`;
    const to = `${year}-${pad2(month0 + 1)}-${pad2(daysInMonth(year, month0))}`;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(
      `/api/agency/departures/calendario?excursion_id=${excursionId}&from=${from}&to=${to}`,
    )
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as CalendarResponse;
        if (!alive) return;
        if (!r.ok || !body.ok) {
          setError(
            body.error_code === "SALIDA_INEXISTENTE"
              ? "Excursión no encontrada"
              : "No se pudo cargar el calendario",
          );
          setData(null);
        } else {
          setData(body);
        }
      })
      .catch(() => {
        if (alive) {
          setError("No se pudo cargar el calendario");
          setData(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [excursionId, year, month0, version]);

  const capDefault = data?.capacity_default ?? 50;
  const diasMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    (data?.dias ?? []).forEach((d) => m.set(d.fecha, d));
    return m;
  }, [data]);
  const legacyByDate = useMemo(() => {
    const m = new Map<string, CalendarLegacySlot[]>();
    (data?.horarios_legacy ?? []).forEach((l) => {
      const arr = m.get(l.fecha) ?? [];
      arr.push(l);
      m.set(l.fecha, arr);
    });
    return m;
  }, [data]);

  const cells: (DayCell | null)[] = useMemo(() => {
    const offset = firstOffset(year, month0);
    const total = daysInMonth(year, month0);
    const out: (DayCell | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let day = 1; day <= total; day++) {
      const iso = `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
      const row = diasMap.get(iso);
      out.push({
        iso,
        day,
        past: iso < today,
        cap: row ? row.eff_cap : capDefault,
        taken: row ? row.taken : 0,
        restante: row ? row.restante : capDefault,
        estado: row ? row.estado : "open",
        legacyCount: legacyByDate.get(iso)?.length ?? 0,
      });
    }
    return out;
  }, [year, month0, diasMap, legacyByDate, capDefault, today]);

  function stepMonth(delta: number) {
    setSelected(null);
    setLimitMode(false);
    setActionError(null);
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  }

  function selectDay(iso: string) {
    setSelected(iso);
    setLimitMode(false);
    setActionError(null);
    setLimitValue("");
  }

  async function doAction(
    accion: "cerrar" | "limitar" | "reabrir",
    capacity?: number,
  ) {
    if (!selected || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/agency/departures/dia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          excursion_id: excursionId,
          departure_date: selected,
          accion,
          ...(accion === "limitar" ? { capacity } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error_code?: string;
        details?: { tomado?: number };
      };
      if (!res.ok || !body.ok) {
        setActionError(
          body.error_code === "CUPO_MENOR_A_RESERVADO"
            ? `El cupo no puede ser menor a lo ya reservado (${body.details?.tomado ?? "?"})`
            : res.status === 403
              ? "Sin permiso para esta acción"
              : "No se pudo aplicar el cambio",
        );
        return;
      }
      setLimitMode(false);
      setLimitValue("");
      setVersion((v) => v + 1); // refetch del mes -> repinta la celda
    } catch {
      setActionError("No se pudo aplicar el cambio");
    } finally {
      setBusy(false);
    }
  }

  const selectedDay = selected ? diasMap.get(selected) : undefined;
  const selectedLegacy = selected ? (legacyByDate.get(selected) ?? []) : [];
  const selExcursionName =
    excursions.find((e) => e.id === excursionId)?.name ?? "";
  const effEstado: "open" | "limited" | "closed" =
    selectedDay?.estado ?? "open";

  function cellClasses(c: DayCell): string {
    const base =
      "relative flex flex-col rounded-lg border p-2 min-h-[68px] text-left cursor-pointer transition";
    const sel = selected === c.iso ? " ring-2 ring-[#b48448]" : "";
    const todayRing =
      c.iso === today ? " outline outline-2 outline-[#143038]" : "";
    const past = c.past ? " opacity-40" : "";
    if (c.estado === "closed")
      return `${base} border-[#ece0c8] bg-[#ece4d2]${sel}${todayRing}${past}`;
    if (c.estado === "limited")
      return `${base} border-[#b48448] bg-white shadow-[inset_3px_0_0_#b48448]${sel}${todayRing}${past}`;
    return `${base} border-[#ece0c8] bg-[#fbf6ea]${sel}${todayRing}${past}`;
  }

  return (
    <div className="space-y-4 text-[#2a2a26]">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={excursionId}
          onChange={(e) => {
            setExcursionId(e.target.value);
            setSelected(null);
          }}
          className="border-stone rounded border px-3 py-1.5 text-sm"
        >
          {excursions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.active ? "" : " (archivada)"}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => stepMonth(-1)}
            className="border-stone hover:bg-stone/20 flex h-8 w-8 items-center justify-center rounded border text-lg"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold capitalize">
            {monthLabel(year, month0)}
          </span>
          <button
            onClick={() => stepMonth(1)}
            className="border-stone hover:bg-stone/20 flex h-8 w-8 items-center justify-center rounded border text-lg"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="text-ash flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span>
          <i className="mr-1.5 inline-block h-3 w-3 rounded-sm border border-[#ece0c8] bg-[#fbf6ea] align-[-2px]" />
          Abierto por defecto (cupo {capDefault})
        </span>
        <span>
          <i className="mr-1.5 inline-block h-3 w-3 rounded-sm bg-[#b48448] align-[-2px]" />
          Cupo limitado
        </span>
        <span>
          <i className="mr-1.5 inline-block h-3 w-3 rounded-sm bg-[#ece4d2] align-[-2px]" />
          Cerrado
        </span>
        <span>
          <i className="mr-1.5 inline-block h-3 w-3 rounded-sm bg-[#143038] align-[-2px]" />
          Número = reservas / cupo
        </span>
      </div>

      <p className="text-ash text-xs">
        Todo abierto todos los días, cupo {capDefault} por defecto. Tocá un día
        para cerrarlo, limitar el cupo o volver a abrirlo.
      </p>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Calendar grid */}
        <div className="rounded-xl border border-[#ece0c8] bg-[#fbf6ea]/40 p-3">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {DOW.map((d) => (
              <div
                key={d}
                className="text-ash text-center text-[11px] font-semibold uppercase"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((c, i) =>
              c === null ? (
                <div key={`b${i}`} />
              ) : (
                <button
                  key={c.iso}
                  onClick={() => selectDay(c.iso)}
                  className={cellClasses(c)}
                >
                  <span className="text-[12px] font-semibold text-[#143038] opacity-80">
                    {c.day}
                  </span>
                  {c.legacyCount > 0 && (
                    <span className="absolute right-1.5 bottom-1.5 rounded-full bg-[#1f4a54]/10 px-1.5 text-[9px] font-semibold text-[#3d6b73]">
                      +{c.legacyCount} hor.
                    </span>
                  )}
                  <span className="mt-auto">
                    {c.estado === "closed" ? (
                      <span className="text-[12px] font-semibold text-[#8a8474]">
                        Cerrado
                      </span>
                    ) : c.taken > 0 ? (
                      <>
                        <span className="text-[15px] font-bold text-[#143038]">
                          {c.taken}
                          <span className="text-[11px] font-medium text-[#7d7768]">
                            /{c.cap}
                          </span>
                        </span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#ece0c8]">
                          <span
                            className={`block h-full rounded-full ${
                              c.cap > 0 && c.taken / c.cap >= 0.8
                                ? "bg-[#b48448]"
                                : "bg-[#143038]"
                            }`}
                            style={{
                              width: `${c.cap > 0 ? Math.min(100, Math.round((c.taken / c.cap) * 100)) : 0}%`,
                            }}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="text-[13px] font-semibold text-[#3d6b73]">
                        <span className="text-[11px] font-normal text-[#7d7768]">
                          cupo{" "}
                        </span>
                        {c.cap}
                      </span>
                    )}
                  </span>
                </button>
              ),
            )}
          </div>
          <p className="text-ash mt-3 text-center text-[11px]">
            {loading
              ? "Cargando…"
              : "Mes lleno = todo abierto. Sin reservas todavía, igual está abierto todos los días."}
          </p>
        </div>

        {/* Read-only day detail */}
        <div className="rounded-xl border border-[#ece0c8] bg-white">
          {!selected ? (
            <div className="text-ash p-5 text-sm">
              Tocá un día para ver su estado, el cupo y los horarios.
            </div>
          ) : (
            <div>
              <div className="rounded-t-xl bg-[#143038] px-4 py-3 text-white">
                <div className="text-sm font-semibold">{selExcursionName}</div>
                <div className="text-[12px] text-[#bcd0cd] capitalize">
                  {dayLabel(selected)}
                </div>
                <span className="mt-2 inline-block rounded-full bg-[#b48448]/25 px-2.5 py-0.5 text-[11px] font-semibold text-[#f0d8b6]">
                  {!selectedDay
                    ? `Abierto por defecto · cupo ${capDefault}`
                    : selectedDay.estado === "closed"
                      ? "Cerrado"
                      : selectedDay.estado === "limited"
                        ? `Cupo limitado a ${selectedDay.eff_cap}`
                        : `Abierto · cupo ${selectedDay.eff_cap}`}
                </span>
              </div>
              <div className="p-4">
                {selectedDay && selectedDay.estado !== "closed" ? (
                  <div className="flex items-baseline justify-between">
                    <div className="text-xl font-bold text-[#143038]">
                      {selectedDay.taken}
                      <span className="text-sm font-medium text-[#7d7768]">
                        {" "}
                        / {selectedDay.eff_cap}
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-[#2f6d4f]">
                      {selectedDay.restante} lugares libres
                    </div>
                  </div>
                ) : !selectedDay ? (
                  <div className="text-ash text-sm">
                    Sin reservas. Disponible cap {capDefault}.
                  </div>
                ) : (
                  <div className="text-ash text-sm">
                    Este día no toma reservas.
                  </div>
                )}

                {selectedLegacy.length > 0 && (
                  <div className="mt-4 border-t border-[#ece0c8] pt-3">
                    <div className="text-ash text-[11px] font-semibold uppercase">
                      Horarios
                    </div>
                    <p className="text-ash mb-2 text-[11px]">
                      Horarios viejos de esta fecha. El modelo nuevo es 1 salida
                      por día.
                    </p>
                    {selectedLegacy.map((s) => (
                      <div
                        key={s.departure_id}
                        className="mb-1.5 flex items-center gap-2 rounded-lg border border-[#ece0c8] bg-[#fbf6ea] px-3 py-2 text-[12px]"
                      >
                        <span className="font-bold text-[#143038]">
                          {s.hora}
                        </span>
                        <span className="text-[#7d7768]">
                          {s.taken > 0 ? (
                            <>
                              <b className="text-[#143038]">
                                {s.taken} reserva(s)
                              </b>{" "}
                              · {s.restante} libres · cupo {s.eff_cap}
                            </>
                          ) : (
                            <>0 reservas · cupo {s.eff_cap}</>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {canEdit && (
                  <div className="mt-4 border-t border-[#ece0c8] pt-3">
                    {actionError && (
                      <div className="mb-2 rounded-md bg-[#9a4b32]/10 px-3 py-2 text-[12px] text-[#9a4b32]">
                        {actionError}
                      </div>
                    )}
                    {!limitMode ? (
                      <div className="flex flex-wrap gap-2">
                        {effEstado !== "closed" && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              setLimitMode(true);
                              setLimitValue(
                                String(selectedDay?.eff_cap ?? capDefault),
                              );
                              setActionError(null);
                            }}
                            className="rounded-lg bg-[#b48448] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                          >
                            {effEstado === "limited"
                              ? "Cambiar cupo"
                              : "Limitar cupo"}
                          </button>
                        )}
                        {effEstado !== "closed" && (
                          <button
                            disabled={busy}
                            onClick={() => doAction("cerrar")}
                            className="rounded-lg bg-[#f2e9d6] px-3 py-2 text-[12px] font-semibold text-[#143038] disabled:opacity-50"
                          >
                            Cerrar este día
                          </button>
                        )}
                        {effEstado !== "open" && (
                          <button
                            disabled={busy}
                            onClick={() => doAction("reabrir")}
                            className="rounded-lg border border-[#ece0c8] bg-white px-3 py-2 text-[12px] font-semibold text-[#143038] disabled:opacity-50"
                          >
                            {effEstado === "closed"
                              ? "Reabrir"
                              : "Volver a abierto por defecto"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-end gap-2">
                        <label className="text-[12px] text-[#7d7768]">
                          Cupo
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={limitValue}
                            onChange={(e) => setLimitValue(e.target.value)}
                            className="mt-1 block w-24 rounded border border-[#ece0c8] px-2 py-1.5 text-[#143038]"
                          />
                        </label>
                        <button
                          disabled={busy || limitValue.trim() === ""}
                          onClick={() =>
                            doAction("limitar", Math.trunc(Number(limitValue)))
                          }
                          className="rounded-lg bg-[#b48448] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "…" : "Aplicar"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setLimitMode(false);
                            setActionError(null);
                          }}
                          className="rounded-lg px-3 py-2 text-[12px] text-[#7d7768]"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    <p className="text-ash mt-2 text-[11px]">
                      El cupo no puede bajar de lo ya reservado ese día.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
