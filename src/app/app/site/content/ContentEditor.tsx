"use client";
import { useState } from "react";

export function ContentEditor({
  tenantId,
  tenantSlug,
  initialContent,
  publishedAt,
}: {
  tenantId: string;
  tenantSlug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialContent: any;
  publishedAt: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [content, setContent] = useState<any>(initialContent);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function updateHero(field: string, value: string) {
    setContent({ ...content, hero: { ...content.hero, [field]: value } });
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/site/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, content_json: content }),
    });
    setSaving(false);
    setStatus(res.ok ? "Guardado ✓" : "Error");
  }

  async function publish() {
    setSaving(true);
    setStatus(null);
    const [r1, r2] = await Promise.all([
      fetch("/api/site/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, content_json: content }),
      }),
      fetch("/api/site/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      }),
    ]);
    setSaving(false);
    setStatus(r1.ok && r2.ok ? "✓ Publicado" : "Error al publicar");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Editor de Contenido</h1>
        <div className="flex gap-2">
          <button
            disabled={saving}
            onClick={save}
            className="bg-stone rounded px-4 py-2"
          >
            Guardar
          </button>
          <button
            disabled={saving}
            onClick={publish}
            className="bg-bone text-onyx rounded px-4 py-2 font-semibold"
          >
            {publishedAt ? "Republicar" : "Publicar"}
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">Hero</h2>
        <label className="block">
          <span className="text-ash text-sm">Slogan</span>
          <input
            value={content.hero?.slogan ?? ""}
            onChange={(e) => updateHero("slogan", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-ash text-sm">Subtítulo</span>
          <input
            value={content.hero?.subtitle ?? ""}
            onChange={(e) => updateHero("subtitle", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-ash text-sm">CTA primario — label</span>
          <input
            value={content.hero?.cta_primary_label ?? ""}
            onChange={(e) => updateHero("cta_primary_label", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-ash text-sm">
            CTA primario — href (WhatsApp URL)
          </span>
          <input
            value={content.hero?.cta_primary_href ?? ""}
            onChange={(e) => updateHero("cta_primary_href", e.target.value)}
            className="bg-marble border-stone mt-1 w-full rounded border px-3 py-2"
          />
        </label>
      </section>

      {status && <p className="text-sm">{status}</p>}
      <p className="text-ash text-xs">
        Vista previa:{" "}
        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={`https://${tenantSlug}.impluxa.com`}
        >
          {tenantSlug}.impluxa.com ↗
        </a>{" "}
        (puede tardar 60s en refrescar)
      </p>
    </div>
  );
}
