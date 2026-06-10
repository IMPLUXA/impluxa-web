"use client";

import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  RateSetInputSchema,
  FactorPercentSchema,
  CURRENCIES,
  type Currency,
  type ExcursionRow,
  type RateRow,
  type PassengerCategoryRow,
} from "@/lib/agency/schemas";

// F3b CRUD UI tarifas (dueño-only write).
// ESCRITURA: exclusivamente (a) RPC agency_set_rate vía cliente browser
// AUTENTICADO (cierre+inserción atómica viven en la RPC, acá NO se
// reimplementa nada) y (b) UPDATE de price_factor en passenger_categories
// (camino dueño-only existente por RLS #23). CERO rutas de escritura nuevas.
// AUTORIDAD UI (decisión declarada): vendedor/encargado ven todo READ-ONLY
// con chip "Solo lectura"; los controles de edición no se renderizan. La RLS
// es la autoridad real — si igual llega un write, la DB lo rechaza.

type RateFormState = {
  excursionId: string | null;
  base_price: string;
  provider_cost: string;
  currency: Currency;
};

const EMPTY_RATE_FORM: RateFormState = {
  excursionId: null,
  base_price: "",
  provider_cost: "",
  currency: "ARS",
};

function fmtMoney(value: string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function factorToPercent(factor: string | null): string {
  if (factor === null) return "—";
  const n = Number(factor);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

// Errores de la RPC / RLS → mensajes accionables. 42501 = sin autoridad
// (dueño-only), 40001 = carrera (reintentar), 22023 = input fuera de cota.
function rpcErrorMessage(code: string | undefined): string {
  if (code === "42501") return "Sin permiso: solo el dueño modifica tarifas.";
  if (code === "40001") return "Conflicto concurrente. Reintentá.";
  if (code === "22023") return "Valor fuera de rango.";
  return "Error al guardar. Reintentá.";
}

export function RatesManager({
  excursions,
  initialRates,
  initialCategories,
  role,
  canEdit,
}: {
  excursions: ExcursionRow[];
  initialRates: RateRow[];
  initialCategories: PassengerCategoryRow[];
  role: string | null;
  canEdit: boolean;
}) {
  const [rates, setRates] = useState<RateRow[]>(initialRates);
  const [categories, setCategories] =
    useState<PassengerCategoryRow[]>(initialCategories);
  const [form, setForm] = useState<RateFormState>(EMPTY_RATE_FORM);
  const [history, setHistory] = useState<{
    excursionId: string;
    rows: RateRow[];
  } | null>(null);
  // Edición de factor por categoría (las 4 editables por el dueño — pedido
  // CEO s49: adulto/niño/infante también, por si el negocio lo necesita).
  const [factorEdit, setFactorEdit] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const rateByExcursion = useMemo(() => {
    const m = new Map<string, RateRow>();
    for (const r of rates) m.set(r.excursion_id, r);
    return m;
  }, [rates]);

  async function refreshRates(): Promise<boolean> {
    const res = await fetch("/api/agency/rates");
    const body = await res.json();
    if (res.ok && body.ok) {
      setRates(body.data as RateRow[]);
      return true;
    }
    return false;
  }

  async function submitRate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.excursionId || busy) return;
    setStatus(null);

    const parsed = RateSetInputSchema.safeParse({
      base_price: form.base_price.trim(),
      provider_cost: form.provider_cost.trim(),
      currency: form.currency,
    });
    if (!parsed.success) {
      setStatus(
        parsed.error.issues[0]?.message ?? "Revisá los valores ingresados.",
      );
      return;
    }

    setBusy(true);
    // try/finally: si el refresh post-RPC explota (red/5xx), busy NO puede
    // quedar trabado — el write ya entró a DB (Pass-1 blocker 2).
    try {
      // La RPC hace el cierre de la vigente + alta de la nueva ATÓMICAMENTE.
      // Plata como string → numeric exacto (cero float en el camino).
      const sb = getSupabaseBrowserClient();
      const { error } = await sb.rpc("agency_set_rate", {
        p_excursion_id: form.excursionId,
        p_base_price: parsed.data.base_price,
        p_provider_cost: parsed.data.provider_cost,
        p_currency: parsed.data.currency,
      });
      if (error) {
        setStatus(rpcErrorMessage(error.code));
        return;
      }
      let refreshed = false;
      try {
        refreshed = await refreshRates();
      } catch {
        refreshed = false;
      }
      setForm(EMPTY_RATE_FORM);
      if (!refreshed) {
        setStatus(
          "Tarifa guardada, pero la tabla no se pudo refrescar. Recargá la página.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(excursionId: string) {
    setStatus(null);
    try {
      const res = await fetch(
        `/api/agency/rates?excursion_id=${encodeURIComponent(excursionId)}`,
      );
      const body = await res.json();
      if (res.ok && body.ok) {
        setHistory({ excursionId, rows: body.data as RateRow[] });
        return;
      }
    } catch {
      // cae al status de abajo
    }
    setStatus("No se pudo cargar el historial.");
  }

  async function saveFactor() {
    if (factorEdit === null || busy) return;
    setStatus(null);

    const parsed = FactorPercentSchema.safeParse(factorEdit.value.trim());
    if (!parsed.success) {
      setStatus(parsed.error.issues[0]?.message ?? "Porcentaje inválido.");
      return;
    }
    const factor = (Number(parsed.data) / 100).toFixed(4);
    const targetId = factorEdit.id;

    setBusy(true);
    // UPDATE directo dueño-only (RLS #23). OJO lesson rls-update-0-filas:
    // un deny llega como 0 filas SIN error → se verifica por el .select().
    const sb = getSupabaseBrowserClient();
    const { data, error } = await sb
      .from("passenger_categories")
      .update({ price_factor: factor })
      .eq("id", targetId)
      .select("id,tenant_id,code,label,price_factor,created_at");
    if (error) {
      setStatus(rpcErrorMessage(error.code));
    } else if (!data || data.length === 0) {
      setStatus("Sin permiso: solo el dueño edita el factor.");
    } else {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === targetId ? (data[0] as PassengerCategoryRow) : c,
        ),
      );
      setFactorEdit(null);
    }
    setBusy(false);
  }

  const formExcursion = excursions.find((x) => x.id === form.excursionId);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Tarifas</h1>
        {!canEdit && (
          <span className="bg-stone/40 text-ash rounded-full px-3 py-1 text-xs">
            Solo lectura{role ? ` (rol: ${role})` : ""}
          </span>
        )}
      </div>

      {status && (
        <div className="border-stone bg-stone/20 mb-4 rounded border px-4 py-2 text-sm">
          {status}
        </div>
      )}

      {/* Tarifas vigentes por excursión */}
      <div className="border-stone overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-stone text-ash border-b">
              <th className="px-4 py-3 font-normal">Excursión</th>
              <th className="px-4 py-3 font-normal">Precio vigente</th>
              <th className="px-4 py-3 font-normal">Costo proveedor</th>
              <th className="px-4 py-3 font-normal">Desde</th>
              <th className="px-4 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {excursions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-ash px-4 py-8 text-center">
                  No hay excursiones activas. Cargalas en Excursiones.
                </td>
              </tr>
            )}
            {excursions.map((x) => {
              const r = rateByExcursion.get(x.id);
              const costIsPlaceholder = r && Number(r.provider_cost) === 0;
              return (
                <tr key={x.id} className="border-stone/50 border-b">
                  <td className="px-4 py-3">{x.name}</td>
                  <td className="px-4 py-3 font-medium">
                    {r ? fmtMoney(r.base_price, r.currency) : "Sin tarifa"}
                  </td>
                  <td className="px-4 py-3">
                    {r ? fmtMoney(r.provider_cost, r.currency) : "—"}
                    {costIsPlaceholder && (
                      <span className="bg-stone/40 text-ash ml-2 rounded-full px-2 py-0.5 text-xs">
                        sin cargar
                      </span>
                    )}
                  </td>
                  <td className="text-ash px-4 py-3">
                    {r ? fmtDate(r.valid_from) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openHistory(x.id)}
                      className="bg-stone/20 hover:bg-stone/40 rounded px-3 py-1 text-xs"
                    >
                      Historial
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setStatus(null);
                          setForm({
                            excursionId: x.id,
                            base_price: r ? r.base_price : "",
                            provider_cost: r ? r.provider_cost : "",
                            currency: (r?.currency ??
                              x.default_currency) as Currency,
                          });
                        }}
                        className="bg-bone text-onyx ml-2 rounded px-3 py-1 text-xs font-medium"
                      >
                        Nueva tarifa
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Categorías de pasajero */}
      <h2 className="text-ash mt-8 mb-3 text-sm tracking-wide uppercase">
        Categorías de pasajero
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => {
          const editing = canEdit && factorEdit?.id === c.id;
          return (
            <div key={c.id} className="border-stone rounded-lg border p-4">
              <div className="text-ash text-xs">{c.label}</div>
              {editing ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={factorEdit.value}
                    onChange={(e) =>
                      setFactorEdit({ id: c.id, value: e.target.value })
                    }
                    inputMode="decimal"
                    aria-label={`Porcentaje del precio adulto para ${c.label}`}
                    className="border-stone w-20 rounded border bg-transparent px-2 py-1 text-sm"
                  />
                  <span className="text-ash text-sm">%</span>
                  <button
                    onClick={saveFactor}
                    disabled={busy}
                    className="bg-bone text-onyx rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setFactorEdit(null)}
                    className="text-ash text-xs underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="text-2xl font-medium">
                    {factorToPercent(c.price_factor)}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() =>
                        setFactorEdit({
                          id: c.id,
                          // toFixed(2)+parseFloat: mata el float-artifact del
                          // round-trip (0.0700*100 = 7.000000000000001 rompía
                          // el propio regex — Pass-1 blocker 1, 25.1% dominio).
                          value:
                            c.price_factor !== null
                              ? String(
                                  parseFloat(
                                    (Number(c.price_factor) * 100).toFixed(2),
                                  ),
                                )
                              : "",
                        })
                      }
                      className="text-ash text-xs underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
              )}
              <div className="text-ash mt-1 text-xs">del precio adulto</div>
            </div>
          );
        })}
      </div>

      {/* Modal: nueva tarifa (versiona vía RPC, cierra la vigente) */}
      {form.excursionId && formExcursion && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="bg-marble w-full max-w-md rounded-lg p-6">
            <h2 className="mb-1 text-xl font-medium">Nueva tarifa</h2>
            <p className="text-ash mb-4 text-sm">
              {formExcursion.name} — la tarifa vigente se cierra y queda en el
              historial.
            </p>
            <form onSubmit={submitRate} className="space-y-3">
              <div>
                <label htmlFor="rate-price" className="mb-1 block text-sm">
                  Precio al turista
                </label>
                <input
                  id="rate-price"
                  value={form.base_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, base_price: e.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="38000"
                  className="border-stone w-full rounded border bg-transparent px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="rate-cost" className="mb-1 block text-sm">
                  Costo proveedor
                </label>
                <input
                  id="rate-cost"
                  value={form.provider_cost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, provider_cost: e.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="25000"
                  className="border-stone w-full rounded border bg-transparent px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="rate-currency" className="mb-1 block text-sm">
                  Moneda
                </label>
                <select
                  id="rate-currency"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currency: e.target.value as Currency,
                    }))
                  }
                  className="border-stone bg-marble w-full rounded border px-3 py-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {status && <div className="text-sm">{status}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(EMPTY_RATE_FORM)}
                  className="bg-stone/20 rounded px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy || !form.base_price.trim()}
                  className="bg-onyx text-bone rounded px-4 py-2 text-sm disabled:opacity-50"
                >
                  {busy ? "Guardando…" : "Guardar tarifa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: historial */}
      {history && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="bg-marble max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg p-6">
            <h2 className="mb-4 text-xl font-medium">
              Historial —{" "}
              {excursions.find((x) => x.id === history.excursionId)?.name}
            </h2>
            {history.rows.length === 0 ? (
              <p className="text-ash text-sm">Sin tarifas registradas.</p>
            ) : (
              <ul className="space-y-2">
                {history.rows.map((r) => (
                  <li
                    key={r.id}
                    className="border-stone/50 flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {fmtMoney(r.base_price, r.currency)}
                        <span className="text-ash ml-2 text-xs">
                          costo {fmtMoney(r.provider_cost, r.currency)}
                        </span>
                      </div>
                      <div className="text-ash text-xs">
                        {fmtDate(r.valid_from)} →{" "}
                        {r.valid_to ? fmtDate(r.valid_to) : "vigente"}
                      </div>
                    </div>
                    {r.valid_to === null && (
                      <span className="bg-bone text-onyx rounded-full px-2 py-0.5 text-xs font-medium">
                        vigente
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setHistory(null)}
                className="bg-stone/20 rounded px-4 py-2 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
