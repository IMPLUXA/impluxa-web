"use client";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CURRENCIES,
  type Category,
  type ExcursionRow,
  type ProviderRow,
} from "@/lib/agency/schemas";

type FormState = {
  id: string | null;
  name: string;
  description: string;
  category: Category;
  provider_id: string;
  default_currency: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  description: "",
  category: "terrestre",
  provider_id: "",
  default_currency: "ARS",
};

export function ExcursionsManager({
  initialExcursions,
  providers,
}: {
  initialExcursions: ExcursionRow[];
  providers: ProviderRow[];
}) {
  const [excursions, setExcursions] =
    useState<ExcursionRow[]>(initialExcursions);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const providerName = useMemo(() => {
    const m = new Map(providers.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? (m.get(id) ?? "—") : "—");
  }, [providers]);

  const visible = excursions.filter(
    (e) =>
      (showInactive || e.active) && (filter === "all" || e.category === filter),
  );

  function startCreate() {
    setForm(EMPTY_FORM);
    setStatus(null);
    setOpen(true);
  }

  function startEdit(e: ExcursionRow) {
    setForm({
      id: e.id,
      name: e.name,
      description: e.description ?? "",
      category: e.category,
      provider_id: e.provider_id ?? "",
      default_currency: e.default_currency,
    });
    setStatus(null);
    setOpen(true);
  }

  async function submit() {
    setBusy(true);
    setStatus(null);
    const isEdit = form.id !== null;
    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      category: form.category,
      provider_id: form.provider_id || null,
      default_currency: form.default_currency,
    };
    if (isEdit) body.id = form.id;
    const res = await fetch("/api/agency/excursions", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(
        res.status === 403
          ? "Sin permiso para esta acción"
          : "Error al guardar",
      );
      return;
    }
    const { data } = await res.json();
    setExcursions((prev) =>
      isEdit ? prev.map((e) => (e.id === data.id ? data : e)) : [data, ...prev],
    );
    setOpen(false);
  }

  async function archive(e: ExcursionRow) {
    setBusy(true);
    const res = await fetch("/api/agency/excursions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: e.id, active: !e.active }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(res.status === 403 ? "Sin permiso para esta acción" : "Error");
      return;
    }
    const { data } = await res.json();
    setExcursions((prev) => prev.map((x) => (x.id === data.id ? data : x)));
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Excursiones</h1>
        <button
          onClick={startCreate}
          className="bg-bone text-onyx rounded px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          + Nueva excursión
        </button>
      </header>

      {/* Filtro de categorías */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-sm ${filter === "all" ? "bg-bone text-onyx" : "bg-stone/30"}`}
        >
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1 text-sm ${filter === c ? "bg-bone text-onyx" : "bg-stone/30"}`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
        <label className="text-ash ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(ev) => setShowInactive(ev.target.checked)}
          />
          Ver archivadas
        </label>
      </div>

      {status && <div className="text-sm text-amber-400">{status}</div>}

      {/* Grilla */}
      {visible.length === 0 ? (
        <p className="text-ash text-sm">
          No hay excursiones{filter !== "all" ? " en esta categoría" : ""}. Creá
          la primera con “+ Nueva excursión”.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => (
            <article
              key={e.id}
              className={`border-stone rounded-lg border p-4 ${e.active ? "" : "opacity-50"}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-medium">{e.name}</h2>
                <span className="bg-stone/40 rounded px-2 py-0.5 text-xs">
                  {CATEGORY_LABELS[e.category]}
                </span>
              </div>
              {e.description && (
                <p className="text-ash mb-2 line-clamp-2 text-sm">
                  {e.description}
                </p>
              )}
              <div className="text-ash text-xs">
                Proveedor: {providerName(e.provider_id)} · {e.default_currency}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => startEdit(e)}
                  disabled={busy}
                  className="bg-stone/40 rounded px-3 py-1 text-xs hover:opacity-90"
                >
                  Editar
                </button>
                <button
                  onClick={() => archive(e)}
                  disabled={busy}
                  className="bg-stone/20 rounded px-3 py-1 text-xs hover:opacity-90"
                >
                  {e.active ? "Archivar" : "Reactivar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Form modal */}
      {open && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="bg-marble text-onyx w-full max-w-lg space-y-4 rounded-lg p-6">
            <h2 className="text-lg font-bold">
              {form.id ? "Editar excursión" : "Nueva excursión"}
            </h2>
            <label className="block text-sm">
              Nombre
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Descripción
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1 text-sm">
                Categoría
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as Category })
                  }
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block flex-1 text-sm">
                Moneda
                <select
                  value={form.default_currency}
                  onChange={(e) =>
                    setForm({ ...form, default_currency: e.target.value })
                  }
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              Proveedor
              <select
                value={form.provider_id}
                onChange={(e) =>
                  setForm({ ...form, provider_id: e.target.value })
                }
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">— Sin proveedor —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {status && <div className="text-sm text-red-600">{status}</div>}
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
                disabled={busy || form.name.trim() === ""}
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
