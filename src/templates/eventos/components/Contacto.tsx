"use client";
import { useId, useState, type FormEvent } from "react";
import type { EventosContent, EventosDesign } from "../schema";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; message: string }
  | { state: "error"; message: string; field?: string };

export function Contacto({
  content,
  design,
  tenantId,
}: {
  content: EventosContent["contacto"];
  design: EventosDesign;
  tenantId: string;
}) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const phoneId = `${baseId}-phone`;
  const emailId = `${baseId}-email`;
  const messageId = `${baseId}-message`;
  const nameErrId = `${nameId}-err`;
  const emailErrId = `${emailId}-err`;

  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const whatsappDigits = content.whatsapp.replace(/[^0-9]/g, "");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();

    const nextErrors: { name?: string; email?: string } = {};
    if (!name) nextErrors.name = "El nombre es obligatorio.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      nextErrors.email = "Ingresá un email válido.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus({
        state: "error",
        message: "Revisá los campos marcados.",
        field: Object.keys(nextErrors)[0],
      });
      return;
    }

    setStatus({ state: "submitting" });
    try {
      const res = await fetch("/api/leads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({
        state: "success",
        message: "Mensaje enviado. Te contactaremos pronto.",
      });
      form.reset();
    } catch {
      setStatus({
        state: "error",
        message:
          "No pudimos enviar el mensaje. Intentá nuevamente o escribinos por WhatsApp.",
      });
    }
  }

  return (
    <section
      id="contacto"
      aria-labelledby="contacto-heading"
      className="px-6 py-20"
      style={{ background: design.colors.background }}
    >
      <h2
        id="contacto-heading"
        className="mb-12 text-center text-3xl font-bold md:text-5xl"
        style={{
          fontFamily: design.fonts.heading,
          color: design.colors.primary,
        }}
      >
        Contacto
      </h2>
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        <address className="not-italic">
          <ul className="space-y-2 p-0" role="list">
            <li>
              <span aria-hidden="true">📍 </span>
              <span className="sr-only">Dirección: </span>
              {content.address}
            </li>
            <li>
              <span aria-hidden="true">📞 </span>
              <span className="sr-only">Teléfono: </span>
              <a
                href={`tel:${content.phone.replace(/[^0-9+]/g, "")}`}
                className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ outlineColor: design.colors.primary }}
              >
                {content.phone}
              </a>
            </li>
            <li>
              <span aria-hidden="true">💬 </span>
              <span className="sr-only">WhatsApp: </span>
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir WhatsApp ${content.whatsapp} (se abre en una nueva pestaña)`}
                className="underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ outlineColor: design.colors.primary }}
              >
                {content.whatsapp}
              </a>
            </li>
            <li>
              <span aria-hidden="true">🕐 </span>
              <span className="sr-only">Horarios: </span>
              {content.hours.join(" · ")}
            </li>
          </ul>
        </address>
        <form
          onSubmit={onSubmit}
          noValidate
          aria-labelledby="contacto-form-title"
          className="space-y-3"
        >
          <h3 id="contacto-form-title" className="sr-only">
            Formulario de contacto
          </h3>
          <input type="hidden" name="tenant_id" value={tenantId} />

          <div>
            <label htmlFor={nameId} className="mb-1 block text-sm font-medium">
              Nombre <span aria-hidden="true">*</span>
              <span className="sr-only"> (obligatorio)</span>
            </label>
            <input
              id={nameId}
              name="name"
              required
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? nameErrId : undefined}
              autoComplete="name"
              className="min-h-[44px] w-full rounded border px-3 py-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: errors.name ? "#B00020" : design.colors.secondary,
                outlineColor: design.colors.primary,
              }}
            />
            {errors.name && (
              <p
                id={nameErrId}
                className="mt-1 text-sm"
                style={{ color: "#B00020" }}
              >
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={phoneId} className="mb-1 block text-sm font-medium">
              Teléfono / WhatsApp
            </label>
            <input
              id={phoneId}
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              className="min-h-[44px] w-full rounded border px-3 py-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: design.colors.secondary,
                outlineColor: design.colors.primary,
              }}
            />
          </div>

          <div>
            <label htmlFor={emailId} className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? emailErrId : undefined}
              className="min-h-[44px] w-full rounded border px-3 py-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: errors.email ? "#B00020" : design.colors.secondary,
                outlineColor: design.colors.primary,
              }}
            />
            {errors.email && (
              <p
                id={emailErrId}
                className="mt-1 text-sm"
                style={{ color: "#B00020" }}
              >
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor={messageId}
              className="mb-1 block text-sm font-medium"
            >
              Mensaje
            </label>
            <textarea
              id={messageId}
              name="message"
              rows={4}
              className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: design.colors.secondary,
                outlineColor: design.colors.primary,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={status.state === "submitting"}
            className="min-h-[44px] w-full rounded py-3 font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70"
            style={{
              background: design.colors.primary,
              color: design.colors.background,
              outlineColor: design.colors.accent,
            }}
          >
            {status.state === "submitting" ? "Enviando…" : "Enviar"}
          </button>

          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-h-[1.5rem] text-sm"
          >
            {status.state === "success" && (
              <span style={{ color: "#0F7A1C" }}>{status.message}</span>
            )}
            {status.state === "error" && (
              <span style={{ color: "#B00020" }}>{status.message}</span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
