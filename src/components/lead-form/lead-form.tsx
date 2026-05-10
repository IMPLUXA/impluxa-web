"use client";
import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { submitLead, type LeadResult } from "./lead-form-actions";
import { INDUSTRIES, BUDGETS } from "./lead-schema";

const INDUSTRY_LABEL: Record<(typeof INDUSTRIES)[number], string> = {
  eventos: "Salón de eventos",
  restaurante: "Restaurante",
  distribuidora: "Distribuidora",
  gimnasio: "Gimnasio / estudio",
  inmobiliaria: "Inmobiliaria",
  clinica: "Clínica / consultorio",
  foodseller: "Vendedor de comida",
  otro: "Otro",
};
const BUDGET_LABEL: Record<(typeof BUDGETS)[number], string> = {
  "70-100": "$70.000 — $100.000 ARS/mes",
  "100-200": "$100.000 — $200.000 ARS/mes",
  "200+": "Más de $200.000 ARS/mes",
  unknown: "Todavía no sé",
};

export function LeadForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LeadResult | null>(null);
  const [token, setToken] = useState("");

  async function action(fd: FormData) {
    fd.set("turnstileToken", token);
    setPending(true);
    const res = await submitLead(fd);
    setResult(res);
    setPending(false);
  }

  if (result?.ok) {
    return (
      <div className="border-bone/30 bg-marble rounded-lg border p-8 text-center">
        <h3 className="font-display text-bone text-3xl">Gracias.</h3>
        <p className="text-bone/70 mt-2">Te escribimos en menos de 24 horas.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input
        type="text"
        name="honeypot"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-[-9999px]"
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Nombre"
          name="name"
          required
          error={result && !result.ok ? result.fields?.name : undefined}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          error={result && !result.ok ? result.fields?.email : undefined}
        />
        <Field label="WhatsApp" name="whatsapp" placeholder="+54 9 2944 ..." />
        <Select
          label="Rubro"
          name="industry"
          required
          options={INDUSTRIES.map((v) => [v, INDUSTRY_LABEL[v]] as const)}
        />
        <Select
          label="Presupuesto mensual"
          name="budget_range"
          options={BUDGETS.map((v) => [v, BUDGET_LABEL[v]] as const)}
        />
      </div>
      <Field label="Contanos sobre tu negocio" name="message" textarea />
      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        onSuccess={setToken}
        options={{ theme: "dark" }}
      />
      {result && !result.ok && (
        <p className="text-sm text-red-400">{result.error}</p>
      )}
      <button
        type="submit"
        disabled={pending || !token}
        className="bg-bone text-onyx hover:bg-cream rounded-md px-8 py-3 text-sm font-medium transition disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
  error?: string;
};

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  textarea,
  error,
}: FieldProps) {
  const inputClass =
    "mt-2 w-full border-b border-stone/40 bg-transparent py-2 text-bone placeholder:text-ash/50 focus:border-bone focus:outline-none";
  return (
    <label className="block">
      <span className="text-ash block text-xs tracking-wider uppercase">
        {label}
        {required && " *"}
      </span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          rows={4}
          className={inputClass}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {error && (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      )}
    </label>
  );
}

function Select({
  label,
  name,
  required,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: Array<readonly [string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-ash block text-xs tracking-wider uppercase">
        {label}
        {required && " *"}
      </span>
      <select
        name={name}
        required={required}
        className="border-stone/40 text-bone focus:border-bone mt-2 w-full border-b bg-transparent py-2 focus:outline-none"
      >
        <option value="">—</option>
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-onyx">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
