"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Step = "email" | "code" | "verifying";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSent("sending");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setSent("error");
      setError(error.message);
      return;
    }
    window.location.href = "/";
  }

  async function handleSendCode() {
    setSent("sending");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
    if (error) {
      setSent("error");
      setError(error.message);
      return;
    }
    setSent("sent");
    setStep("code");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStep("verifying");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.verifyOtp({
      email,
      token: token.trim(),
      type: "email",
    });
    if (error) {
      setError(error.message);
      setStep("code");
      return;
    }
    window.location.href = "/";
  }

  function handleBack() {
    setStep("email");
    setToken("");
    setError(null);
    setSent("idle");
  }

  return (
    <main className="bg-onyx text-bone flex min-h-screen items-center justify-center p-6">
      {step === "email" && (
        <form onSubmit={handlePassword} className="w-full max-w-sm space-y-4">
          <h1 className="font-serif text-2xl">Impluxa</h1>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
            className="bg-marble border-stone w-full rounded border px-3 py-2"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password (opcional)"
            autoComplete="current-password"
            className="bg-marble border-stone w-full rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={sent === "sending"}
            className="bg-bone text-onyx w-full rounded py-2 disabled:opacity-50"
          >
            Entrar con password
          </button>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sent === "sending" || !email}
            className="border-bone w-full rounded border py-2 disabled:opacity-50"
          >
            {sent === "sending" ? "Enviando..." : "Enviar código por email"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      {(step === "code" || step === "verifying") && (
        <form onSubmit={handleVerifyCode} className="w-full max-w-sm space-y-4">
          <h1 className="font-serif text-2xl">Impluxa</h1>
          <p className="text-ash text-sm">
            Te enviamos un código de 6 dígitos a{" "}
            <span className="text-bone font-medium">{email}</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
            placeholder="código de 6 dígitos"
            className="bg-marble border-stone w-full rounded border px-3 py-2 text-center text-2xl tracking-widest"
            autoFocus
          />
          <button
            type="submit"
            disabled={step === "verifying" || token.length < 6}
            className="bg-bone text-onyx w-full rounded py-2 disabled:opacity-50"
          >
            {step === "verifying" ? "Verificando..." : "Verificar código"}
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="text-ash w-full text-center text-sm underline"
          >
            Volver
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </main>
  );
}
