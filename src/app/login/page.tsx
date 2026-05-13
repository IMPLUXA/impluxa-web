"use client";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function handleMagic() {
    setSent("sending");
    setError(null);
    const sb = getSupabaseBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setSent("error");
      setError(error.message);
      return;
    }
    setSent("sent");
  }

  return (
    <main className="bg-onyx text-bone flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handlePassword} className="w-full max-w-sm space-y-4">
        <h1 className="font-serif text-2xl">Impluxa</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="bg-marble border-stone w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="bg-marble border-stone w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={sent === "sending"}
          className="bg-bone text-onyx w-full rounded py-2"
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={handleMagic}
          className="border-bone w-full rounded border py-2"
        >
          Enviar magic link
        </button>
        {sent === "sent" && (
          <p className="text-ash text-sm">Revisa tu email.</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
