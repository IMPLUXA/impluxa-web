"use client";
import { useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// F-UI-BRANDED corte 1 — form de login SOLO-OTP (decisión CEO v2: el path
// password desaparece de la UI en TODOS los hosts; el flujo productivo ya era
// OTP). El look se controla 100% por CSS vars `--lg-*` que setea el server
// wrapper (genérico Impluxa o branded por tenant) — un solo markup, cero
// branch visual acá. La navegación post-login viene por prop (en host de
// tenant: /admin/dashboard; en host SaaS: / → /app), pedido (a) del CEO.

type Step = "email" | "code" | "verifying";

const OTP_LEN = 6;

export function LoginForm({
  postLoginPath,
  brandedTenantName,
}: {
  postLoginPath: string;
  brandedTenantName: string | null;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cellsRef = useRef<Array<HTMLInputElement | null>>([]);

  const token = digits.join("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setSending(false);
    if (error) {
      // Mensaje genérico a propósito: el error crudo de GoTrue distingue
      // email-existente de inexistente = oráculo de enumeración en página
      // pública (Pass-2 SE). El detalle real queda en consola para debug.
      console.warn("signInWithOtp error:", error.message);
      setError(
        "No pudimos enviar el código. Verificá el email e intentá de nuevo en unos minutos.",
      );
      return;
    }
    setDigits(Array(OTP_LEN).fill(""));
    setStep("code");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (step === "verifying" || token.length < OTP_LEN) return;
    setStep("verifying");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      setError(error.message);
      setStep("code");
      return;
    }
    window.location.href = postLoginPath;
  }

  function handleBack() {
    setStep("email");
    setDigits(Array(OTP_LEN).fill(""));
    setError(null);
  }

  function setDigit(i: number, value: string) {
    const v = value.replace(/\D/g, "");
    setDigits((prev) => {
      const next = [...prev];
      if (v.length <= 1) {
        next[i] = v;
      } else {
        // paste o autofill: distribuir desde la celda i
        for (let k = 0; k < v.length && i + k < OTP_LEN; k++) {
          next[i + k] = v[k]!;
        }
      }
      return next;
    });
    if (v.length === 1 && i < OTP_LEN - 1) cellsRef.current[i + 1]?.focus();
    if (v.length > 1) {
      const last = Math.min(i + v.length, OTP_LEN - 1);
      cellsRef.current[last]?.focus();
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      cellsRef.current[i - 1]?.focus();
    }
  }

  const inputCls =
    "w-full rounded-[10px] border px-3.5 py-3 text-[15px] outline-none " +
    "bg-[var(--lg-input-bg)] border-[var(--lg-input-border)] text-[var(--lg-text)] " +
    "focus:border-[var(--lg-accent)] focus:ring-[3px] focus:ring-[var(--lg-focus-ring)]";
  const btnCls =
    "w-full rounded-[10px] py-3 text-[15px] font-semibold transition " +
    "bg-[var(--lg-btn-bg)] text-[var(--lg-btn-text)] hover:bg-[var(--lg-btn-bg-hover)] " +
    "active:translate-y-px disabled:opacity-50";

  if (step === "email") {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[13px] font-semibold text-[var(--lg-heading)]"
          >
            Tu email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputCls}
          />
        </div>
        <button type="submit" disabled={sending || !email} className={btnCls}>
          {sending ? "Enviando..." : "Enviar código de acceso"}
        </button>
        <p className="text-center text-[13px] text-[var(--lg-muted)]">
          Te llega un código de un solo uso por email. Sin contraseñas.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="space-y-4">
      <p className="text-sm text-[var(--lg-muted)]">
        Enviamos un código de {OTP_LEN} dígitos a{" "}
        <span className="font-medium text-[var(--lg-text)]">{email}</span>
        {brandedTenantName ? (
          <> para entrar al panel de {brandedTenantName}</>
        ) : null}
      </p>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-[var(--lg-heading)]">
          Código de acceso
        </span>
        <div
          className="flex justify-between gap-2.5"
          role="group"
          aria-label={`código de ${OTP_LEN} dígitos`}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                cellsRef.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={OTP_LEN}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              autoFocus={i === 0}
              disabled={step === "verifying"}
              aria-label={`dígito ${i + 1}`}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className={
                "h-[52px] w-full rounded-[10px] border text-center text-2xl font-semibold outline-none " +
                "border-[var(--lg-input-border)] bg-[var(--lg-input-bg)] text-[var(--lg-heading)] " +
                "focus:border-[var(--lg-accent)] focus:ring-[3px] focus:ring-[var(--lg-focus-ring)]"
              }
            />
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={step === "verifying" || token.length < OTP_LEN}
        className={btnCls}
      >
        {step === "verifying" ? "Verificando..." : "Verificar y entrar"}
      </button>
      <p className="text-center text-[13px] text-[var(--lg-muted)]">
        El código vence en unos minutos. Revisá spam si no llega.
      </p>
      <button
        type="button"
        onClick={handleBack}
        className="block w-full text-center text-[13px] text-[var(--lg-muted)] underline-offset-2 hover:underline"
      >
        Volver
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
