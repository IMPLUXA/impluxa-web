"use client";
import { useState } from "react";
import type { ProviderRow } from "@/lib/agency/schemas";

type FormState = {
  id: string | null;
  name: string;
  payout_terms: string;
  phone: string;
  email: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  payout_terms: "mensual",
  phone: "",
  email: "",
};

export function ProvidersManager({
  initialProviders,
}: {
  initialProviders: ProviderRow[];
}) {
  const [providers, setProviders] = useState<ProviderRow[]>(initialProviders);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const visible = providers.filter((p) => showInactive || p.active);

  function startCreate() {
    setForm(EMPTY_FORM);
    setStatus(null);
    setOpen(true);
  }

  function startEdit(p: ProviderRow) {
    setForm({
      id: p.id,
      name: p.name,
      payout_terms: p.payout_terms ?? "mensual",
      phone: p.contact_json?.phone ?? "",
      email: p.contact_json?.email ?? "",
    });
    setStatus(null);
    setOpen(true);
  }

  async function submit() {
    setBusy(true);
    setStatus(null);
    const isEdit = form.id !== null;
    const contact_json: Record<string, string> = {};
    if (form.phone.trim()) contact_json.phone = form.phone.trim();
    if (form.email.trim()) contact_json.email = form.email.trim();
    const body: Record<string, unknown> = {
      name: form.name,
      payout_terms: form.payout_terms || undefined,
      contact_json,
    };
    if (isEdit) body.id = form.id;
    const res = await fetch("/api/agency/providers", {
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
    setProviders((prev) =>
      isEdit ? prev.map((p) => (p.id === data.id ? data : p)) : [...prev, data],
    );
    setOpen(false);
  }

  async function archive(p: ProviderRow) {
    setBusy(true);
    const res = await fetch("/api/agency/providers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: p.id, active: !p.active }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(res.status === 403 ? "Sin permiso para esta acción" : "Error");
      return;
    }
    const { data } = await res.json();
    setProviders((prev) => prev.map((x) => (x.id === data.id ? data : x)));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Proveedores</h1>
        <button
          onClick={startCreate}
          className="bg-bone text-onyx rounded px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          + Nuevo proveedor
        </button>
      </header>

      <label className="text-ash flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(ev) => setShowInactive(ev.target.checked)}
        />
        Ver archivados
      </label>

      {!open && status && (
        <div className="text-sm text-amber-400">{status}</div>
      )}

      {visible.length === 0 ? (
        <p className="text-ash text-sm">
          No hay proveedores. Creá el primero con “+ Nuevo proveedor”.
        </p>
      ) : (
        <div className="border-stone divide-stone/60 divide-y rounded-lg border">
          {visible.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-3 p-4 ${p.active ? "" : "opacity-50"}`}
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-ash text-xs">
                  Pago: {p.payout_terms}
                  {p.contact_json?.phone ? ` · ${p.contact_json.phone}` : ""}
                  {p.contact_json?.email ? ` · ${p.contact_json.email}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(p)}
                  disabled={busy}
                  className="bg-stone/40 rounded px-3 py-1 text-xs hover:opacity-90"
                >
                  Editar
                </button>
                <button
                  onClick={() => archive(p)}
                  disabled={busy}
                  className="bg-stone/20 rounded px-3 py-1 text-xs hover:opacity-90"
                >
                  {p.active ? "Archivar" : "Reactivar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="bg-onyx/70 fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="bg-marble text-onyx w-full max-w-md space-y-4 rounded-lg p-6">
            <h2 className="text-lg font-bold">
              {form.id ? "Editar proveedor" : "Nuevo proveedor"}
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
              Términos de pago
              <input
                value={form.payout_terms}
                onChange={(e) =>
                  setForm({ ...form, payout_terms: e.target.value })
                }
                placeholder="mensual"
                className="border-stone mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1 text-sm">
                Teléfono
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="block flex-1 text-sm">
                Email
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="border-stone mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            </div>
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
