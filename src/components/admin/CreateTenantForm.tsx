"use client";
import { useState } from "react";

export function CreateTenantForm() {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [templateKey, setTemplateKey] = useState("eventos");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name,
        template_key: templateKey,
        owner_email: ownerEmail,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setStatus(
        `✓ Tenant creado. Owner recibirá magic link en ${ownerEmail}. Slug: ${j.slug}`,
      );
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(`Error: ${(j as { error?: string }).error ?? res.statusText}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" v={name} set={setName} />
      <Field
        label="Slug (sin .impluxa.com)"
        v={slug}
        set={(s: string) => setSlug(s.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
      />
      <label className="block">
        <span className="text-ash text-sm">Template</span>
        <select
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
        >
          <option value="eventos">eventos</option>
        </select>
      </label>
      <Field
        label="Email del owner (cliente)"
        v={ownerEmail}
        set={setOwnerEmail}
        type="email"
      />
      <button
        disabled={busy}
        className="bg-bone text-onyx rounded px-4 py-2 font-semibold"
      >
        Crear tenant
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}

function Field({
  label,
  v,
  set,
  type = "text",
}: {
  label: string;
  v: string;
  set: (s: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-ash text-sm">{label}</span>
      <input
        value={v}
        onChange={(e) => set(e.target.value)}
        type={type}
        required
        className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
      />
    </label>
  );
}
