"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DOW,
  buildMonthCells,
  monthLabel,
  monthRange,
  todayIso,
} from "@/lib/agency/calendar-dates";

// F1d-agregado — calendario de VENTAS por dia cruzando TODAS las excursiones. UN componente, dos
// modos: `availability` (Salidas, opcion "Todas las excursiones") y `sales` (Reservas). Misma
// grilla/fetch/drill-in; cambia el encabezado y el hint del day-detail. SALES-ONLY (no hay barra de
// cupo: no hay denominador honesto sumando 19 caps). Branded PV con hex explicito (patron SalidasCalendar).

type DiaAgg = {
  fecha: string;
  pax_total: number;
  excursiones_con_venta: number;
};
type DetalleAgg = {
  fecha: string;
  excursion_id: string;
  excursion_nombre: string;
  pax_total: number;
  // F1d s59: estado de la venta de ese dia para esa excursion (sin "quedan" — el cupo unico por
  // excursion-dia es mal-definido con multi-pool legacy; el quedan honesto va post-F1b.3).
  estado?: "abierta" | "cerrada" | "cancelada";
};
type AggResponse = {
  ok?: boolean;
  dias?: DiaAgg[];
  detalle?: DetalleAgg[];
  error_code?: string;
};

const dayFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
});
function dayLabel(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}

export function AggregatedCalendar({
  mode,
  onDrillToList,
}: {
  mode: "availability" | "sales";
  // v1.1 (solo sales): drill de una excursion-dia hacia la Lista filtrada.
  onDrillToList?: (excursionId: string, fecha: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [data, setData] = useState<AggResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayIso();

  useEffect(() => {
    const { from, to } = monthRange(year, month0);
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/agency/departures/calendario-agregado?from=${from}&to=${to}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as AggResponse;
        if (!alive) return;
        if (!r.ok || !body.ok) {
          setError("No se pudo cargar el calendario");
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
  }, [year, month0]);

  const diasMap = useMemo(
    () => new Map((data?.dias ?? []).map((d) => [d.fecha, d])),
    [data],
  );
  const cells = useMemo(
    () => buildMonthCells(year, month0, today),
    [year, month0, today],
  );
  const selectedDetalle = useMemo(
    () =>
      selected ? (data?.detalle ?? []).filter((d) => d.fecha === selected) : [],
    [selected, data],
  );
  const selectedDia = selected ? diasMap.get(selected) : undefined;
  const canDrill = mode === "sales" && typeof onDrillToList === "function";

  function stepMonth(delta: number) {
    setSelected(null);
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  }

  return (
    <div className="space-y-4 text-[#2a2a26]">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-ash text-xs">
          {mode === "sales"
            ? "Lo vendido por dia, todas las excursiones juntas. Toca un dia para el detalle."
            : "Todas las excursiones juntas: lo vendido por dia. Para cerrar/limitar el cupo, elegi una excursion arriba."}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => stepMonth(-1)}
            className="border-stone hover:bg-stone/20 flex h-8 w-8 items-center justify-center rounded border text-lg"
            aria-label="Mes anterior"
          >
            &lsaquo;
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold capitalize">
            {monthLabel(year, month0)}
          </span>
          <button
            onClick={() => stepMonth(1)}
            className="border-stone hover:bg-stone/20 flex h-8 w-8 items-center justify-center rounded border text-lg"
            aria-label="Mes siguiente"
          >
            &rsaquo;
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Grid */}
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
                (() => {
                  const dia = diasMap.get(c.iso);
                  const sel =
                    selected === c.iso ? " ring-2 ring-[#b48448]" : "";
                  const todayRing =
                    c.iso === today
                      ? " outline outline-2 outline-[#143038]"
                      : "";
                  const past = c.past ? " opacity-40" : "";
                  return (
                    <button
                      key={c.iso}
                      onClick={() => setSelected(c.iso)}
                      className={`relative flex min-h-[64px] cursor-pointer flex-col rounded-lg border border-[#ece0c8] bg-[#fbf6ea] p-2 text-left transition${sel}${todayRing}${past}`}
                    >
                      <span className="text-[12px] font-semibold text-[#143038] opacity-80">
                        {c.day}
                      </span>
                      {dia ? (
                        <span className="mt-auto">
                          <span className="text-[16px] font-bold text-[#143038]">
                            {dia.pax_total}
                            <span className="text-[10px] font-medium text-[#7d7768]">
                              {" "}
                              pax
                            </span>
                          </span>
                          <span className="block text-[10px] text-[#3d6b73]">
                            {dia.excursiones_con_venta} exc.
                          </span>
                        </span>
                      ) : null}
                    </button>
                  );
                })()
              ),
            )}
          </div>
          <p className="text-ash mt-3 text-center text-[11px]">
            {loading
              ? "Cargando…"
              : "Los dias con ventas estan marcados; el resto, sin reservas todavia."}
          </p>
        </div>

        {/* Day detail */}
        <div className="rounded-xl border border-[#ece0c8] bg-white">
          {!selected ? (
            <div className="text-ash p-5 text-sm">
              Toca un dia para ver que se vendio.
            </div>
          ) : (
            <div>
              <div className="rounded-t-xl bg-[#143038] px-4 py-3 text-white">
                <div className="text-sm font-semibold capitalize">
                  {dayLabel(selected)}
                </div>
                <div className="text-[12px] text-[#bcd0cd]">
                  {selectedDia
                    ? `${selectedDia.pax_total} pax · ${selectedDia.excursiones_con_venta} excursion(es)`
                    : "Sin ventas este dia"}
                </div>
              </div>
              <div className="p-4">
                {selectedDetalle.length === 0 ? (
                  <div className="text-ash text-sm">Sin reservas este dia.</div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDetalle.map((d) => {
                      const inner = (
                        <>
                          <span className="flex items-center gap-1.5 font-medium text-[#143038]">
                            {d.excursion_nombre}
                            {d.estado === "cancelada" && (
                              <span className="rounded bg-[#f3d9d3] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a3412]">
                                salida cancelada
                              </span>
                            )}
                            {d.estado === "cerrada" && (
                              <span className="rounded bg-[#ece4d2] px-1.5 py-0.5 text-[10px] font-semibold text-[#7a5527]">
                                cerrada
                              </span>
                            )}
                          </span>
                          <span className="font-bold text-[#143038]">
                            {d.pax_total}
                            <span className="text-[10px] font-medium text-[#7d7768]">
                              {" "}
                              pax
                            </span>
                          </span>
                        </>
                      );
                      return canDrill ? (
                        <button
                          key={d.excursion_id}
                          type="button"
                          onClick={() =>
                            onDrillToList!(d.excursion_id, d.fecha)
                          }
                          className="flex w-full items-center justify-between rounded-lg border border-[#ece0c8] bg-[#fbf6ea] px-3 py-2 text-left text-[13px] transition hover:border-[#b48448] hover:bg-[#f5ecd8]"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div
                          key={d.excursion_id}
                          className="flex items-center justify-between rounded-lg border border-[#ece0c8] bg-[#fbf6ea] px-3 py-2 text-[13px]"
                        >
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-ash mt-3 border-t border-[#ece0c8] pt-3 text-[11px]">
                  {mode === "sales"
                    ? canDrill
                      ? "Toca una excursion para ver sus reservas en la lista."
                      : "Para ver las reservas, abri la lista y filtra por excursion."
                    : "Para cerrar o limitar el cupo de un dia, elegi esa excursion en el selector de arriba."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
